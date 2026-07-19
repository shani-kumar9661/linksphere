# Custom Short URLs: Validation & Database Indexing

This document outlines the engineering architecture, validation mechanisms, and database indexing strategies used to support custom short URL aliases in LinkSphere.

---

## 1. Input Validation & Sanitization

To ensure system integrity and high-quality URLs, custom aliases undergo a strict validation and normalization pipeline.

### Normalization
1. **Trimming**: Any leading or trailing whitespace is stripped.
2. **Lowercasing**: The input is converted to lowercase. This enforces case-insensitive custom URLs (e.g. `smarturl.com/ChatGPT` and `smarturl.com/chatgpt` resolve to the same destination and prevent duplicate registrations under different casings).

### Character & Length Rules
We validate custom aliases against the following constraints:
- **Format**: Only alphanumeric characters, dashes, and underscores are allowed (`a-z`, `0-9`, `-`, `_`).
- **Length**: Must be between 3 and 30 characters.
- **Regex**: `/^[a-z0-9-_]{3,30}$/`

### Reserved Words Protection
Certain words are reserved by the system because they conflict with web application routing, backend APIs, or static files. Allowing users to register them as custom aliases could block access to essential services or allow phishing.

Examples of protected categories:
- **Auth Routes**: `login`, `register`, `logout`, `auth`
- **Application Views**: `dashboard`, `settings`, `profile`, `config`, `setup`
- **Utility / Files**: `favicon`, `robots.txt`, `sitemap.xml`, `manifest.json`, `assets`, `static`, `public`
- **API Paths**: `api`, `v1`, `urls`, `health`, `test-error`

If a user tries to create an alias that matches a word in the `RESERVED_WORDS` set, the server rejects the request with a `400 Bad Request` status and a clear message: `"This custom alias is a reserved word and cannot be used"`.

---

## 2. Duplicate Check Mechanism

A custom alias must be globally unique across all shortened URLs. It must not collide with:
1. An existing custom alias.
2. An automatically-generated short code (e.g., `jlr1MJ`).

### Case-Insensitive Validation
When a custom alias is registered, we run a query against the MongoDB collection:
```javascript
const existingAlias = await Url.findOne({
  $or: [
    { customAlias: aliasNormalized },
    { shortCode: { $regex: new RegExp(`^${aliasNormalized}$`, 'i') } }
  ]
});
```
- **`customAlias` match**: Since all custom aliases are saved in lowercase, we perform a direct, highly-optimized exact match.
- **`shortCode` match**: Automatically-generated short codes are case-sensitive Base62 strings. To ensure a custom alias doesn't conflict with a generated code of any casing (e.g., custom alias `abc` colliding with generated code `AbC`), we check the `shortCode` field using a case-insensitive regex pattern.

---

## 3. Database Indexing & Performance

Efficient lookup is critical because redirects occur frequently and must be as fast as possible.

### Mongoose/MongoDB Schema Definition
In [Url.js](file:///d:/LinkSphere/server/src/models/Url.js), the fields are indexed as follows:
```javascript
shortCode: {
  type: String,
  required: [true, 'Short code is required'],
  unique: true,
  trim: true,
  index: true
},
customAlias: {
  type: String,
  unique: true,
  sparse: true,
  trim: true,
  index: true
}
```

### Key Indexing Engineering Principles
1. **Unique Indexes**: MongoDB automatically creates unique indexes for fields marked `unique: true`. This guarantees at the database level that no two documents can have the same `shortCode` or `customAlias`.
2. **Sparse Indexes (`sparse: true`)**:
   - By default, MongoDB unique indexes reject multiple documents containing `null` or missing values for that indexed field.
   - Since custom aliases are optional, most shortened URLs will have `customAlias` omitted (or set to `undefined`).
   - A **sparse index** instructs MongoDB to only create index entries for documents where the `customAlias` field actually exists. Documents without a custom alias are excluded from the index.
   - This prevents unique key collisions on empty/undefined values and keeps the index size extremely small and memory-resident.
3. **Case Normalization over Collation**:
   - While MongoDB supports case-insensitive indexes using collation rules (e.g., `collation: { locale: 'en', strength: 2 }`), collation can slow down queries, increase index overhead, and add development complexity.
   - By normalizing custom aliases to lowercase before persisting them, we achieve high-performance case-insensitive lookups using standard, raw indexes.

### Query Routing
During redirection, the query checks both indexes:
```javascript
const url = await Url.findOne({
  $or: [
    { shortCode: shortCode },
    { customAlias: shortCode.toLowerCase() }
  ]
});
```
Because both `shortCode` and `customAlias` have unique indexes, MongoDB resolves this query in `O(1)` time using index scans (IXSCAN) without table scans (COLLSCAN), maintaining sub-millisecond redirect latencies.
