# Meilisearch React Explorer - Project Guide

## Project Overview
A React.js frontend application for exploring and managing Meilisearch indexes with session-based API key authentication.

## Technology Stack
- **Frontend Framework**: React 18 (Vite)
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Meilisearch Client**: `meilisearch` npm package
- **Build Tool**: Vite
- **Package Manager**: Yarn

## Project Structure

```
/Users/taiphuong/code/mytoool/
├── src/
│   ├── components/
│   │   └── Layout.jsx              # App layout with header, nav, logout
│   ├── context/
│   │   └── AuthContext.jsx         # Auth state & Meilisearch client provider
│   ├── pages/
│   │   ├── Login.jsx               # API key login page
│   │   ├── IndexList.jsx           # Lists all indexes with metadata
│   │   └── IndexDetail.jsx         # Index details, search, facets
│   ├── lib/
│   │   └── meilisearch.js          # Meilisearch config (host only)
│   ├── App.jsx                     # Root component with routing
│   ├── main.jsx                    # Entry point
│   └── index.css                   # Tailwind imports
├── vite.config.js                  # Vite + Tailwind plugin config
├── package.json
└── .env                            # VITE_MEILISEARCH_HOST
```

## Architecture

### Authentication Flow
1. **Entry Point**: App loads, `AuthProvider` wraps everything
2. **Session Check**: `AuthContext` reads `sessionStorage` for `meilisearch_api_key`
3. **Route Protection**: `ProtectedRoute` component checks `apiKey` state
4. **Unauthenticated**: Redirect to `/login`
5. **Login**: User enters API key → stored in `sessionStorage` → Meilisearch client created
6. **Logout**: Clear `sessionStorage` → redirect to `/login`

### State Management
- **AuthContext** (`src/context/AuthContext.jsx`):
  - Manages: `apiKey`, `client`
  - Methods: `login(key)`, `logout()`
  - Client creation: Dynamic based on user-provided API key
  - Persistence: `sessionStorage`

### Key Components

#### 1. AuthContext (`src/context/AuthContext.jsx`)
```javascript
// Provides:
const { apiKey, client, login, logout } = useAuth();

// Client initialization:
new MeiliSearch({
  host: VITE_MEILISEARCH_HOST,
  apiKey: userProvidedKey
})
```

#### 2. Layout (`src/components/Layout.jsx`)
- Header with app title
- Navigation links (Indexes, Docs)
- Logout button
- Outlet for nested routes

#### 3. Login (`src/pages/Login.jsx`)
- Password input for API key
- Auto-redirect if already authenticated
- Calls `login()` on submit

#### 4. IndexList (`src/pages/IndexList.jsx`)
**Features:**
- Fetches all indexes via `client.getIndexes()`
- Shows: `uid`, `primaryKey`, `createdAt`, `updatedAt`
- Displays stats: `numberOfDocuments`, `isIndexing` status
- Click to navigate to index details

**Key Logic:**
```javascript
const { client } = useAuth();
const response = await client.getIndexes();
const stats = await client.index(uid).getStats();
```

#### 5. IndexDetail (`src/pages/IndexDetail.jsx`)
**Features:**
- Index stats and status
- Searchable/Filterable/Sortable attributes display
- Collapsible full settings JSON
- Real-time search with autocomplete
- Facet distribution sidebar
- Collapsible document results
- **Clear All Documents** button

**Key APIs:**
```javascript
// Fetch data
await index.getStats();
await index.getSettings();
await index.search(query, { facets: ['*'] });

// Clear documents
await index.deleteAllDocuments();
```

**State:**
- `stats`, `settings`, `documents`, `facetDistribution`
- `suggestions`, `showSuggestions` (autocomplete)
- `searchQuery`, `loading`, `searching`, `error`

## Features Implemented

### ✅ Authentication
- Login with Meilisearch API key
- Session persistence (`sessionStorage`)
- Protected routes
- Auto-redirect if authenticated/unauthenticated
- Logout functionality

### ✅ Index Management
- List all indexes with metadata
- View index details (stats, settings)
- Display indexed attributes (searchable, filterable, sortable)
- Clear all documents from index (with confirmation)

### ✅ Search & Discovery
- Real-time search within index
- Autocomplete suggestions (top 5 results)
- Facet distribution display
- Collapsible document details

### ✅ UI/UX
- Dark mode support (Tailwind)
- Responsive design
- Loading states
- Error handling
- Smooth transitions

## Environment Configuration

### Required Variables
```bash
# .env
VITE_MEILISEARCH_HOST=http://localhost:7700  # Default if not set
```

### Not Used Anymore
- `VITE_MEILISEARCH_API_KEY` (removed - now user-provided via login)

## Development Setup

### Prerequisites
```bash
# Ensure Meilisearch server is running
# Default: http://localhost:7700
```

### Installation
```bash
cd /Users/taiphuong/code/mytoool
yarn install
```

### Run Development Server
```bash
yarn dev
# Opens at http://localhost:5173
```

### Build Production
```bash
yarn build
yarn preview  # Preview production build
```

## API Integration Points

### Meilisearch APIs Used
1. **Authentication**: N/A (API key passed in client initialization)
2. **Get Indexes**: `GET /indexes` → `client.getIndexes()`
3. **Get Stats**: `GET /indexes/{uid}/stats` → `index.getStats()`
4. **Get Settings**: `GET /indexes/{uid}/settings` → `index.getSettings()`
5. **Search**: `POST /indexes/{uid}/search` → `index.search(query, options)`
6. **Delete All Documents**: `DELETE /indexes/{uid}/documents` → `index.deleteAllDocuments()`

## Common Tasks

### Add New Feature to IndexDetail
1. Add state in `IndexDetail` component
2. Fetch data in `fetchIndexData()` callback
3. Add dependency to `useCallback` if needed
4. Render in JSX

### Modify Authentication
- Edit `src/context/AuthContext.jsx`
- Update `sessionStorage` key if needed
- Modify client initialization logic

### Add New Route
1. Create page component in `src/pages/`
2. Add route in `src/App.jsx`
3. Wrap in `<ProtectedRoute>` if auth required

### Change Styling
- Tailwind classes in JSX
- Global styles in `src/index.css`

## Troubleshooting

### Issue: API calls not firing on refresh
**Solution**: Ensure `client` is in `useEffect` dependency arrays

### Issue: Not redirecting to login
**Solution**: Check `ProtectedRoute` logic in `App.jsx`

### Issue: Client undefined errors
**Solution**: Add null checks: `if (!client) return;`

### Issue: Session not persisting
**Solution**: Check `sessionStorage` in browser DevTools → Application tab

## Future Enhancements (Not Implemented)
- Pagination for large result sets
- Advanced filtering (apply facet filters)
- Document upload/edit UI
- Index creation/deletion UI
- Settings editor
- Task queue monitoring
- Multi-index search

## Important Notes
- API key stored in `sessionStorage` (cleared on tab/browser close)
- All routes except `/login` require authentication
- Client recreated on every API key change
- Index settings preserved when clearing documents
- Meilisearch must be running before app starts

## Contact & Resources
- [Meilisearch Docs](https://www.meilisearch.com/docs)
- [React Router Docs](https://reactrouter.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
