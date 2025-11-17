# PMO API Documentation

A beautiful, comprehensive documentation website for the PMO (Project Management Office) API, featuring modern design, interactive examples, and complete endpoint coverage.

## 📁 Documentation Structure

```
docs/
├── index.html              # Main documentation page
├── modules.html            # Detailed module documentation
├── assets/
│   ├── css/
│   │   └── style.css      # Complete styling system
│   └── js/
│       └── script.js      # Interactive functionality
└── README.md              # This file
```

## 🚀 Getting Started

### Option 1: Simple File Server
Open the documentation by simply opening `index.html` in your web browser, or serve it with a simple HTTP server:

```powershell
# Using Python
cd "D:\PMO\API\docs"
python -m http.server 8080

# Using Node.js (if you have it)
cd "D:\PMO\API\docs"
npx serve .

# Using PowerShell (Windows 10+)
cd "D:\PMO\API\docs"
# Then open index.html directly in browser
```

### Option 2: With Your API Server
If you're running the FastAPI server, the documentation will be available at:
- Main API: `http://localhost:5000`
- Documentation: `http://localhost:5000/docs` (built-in FastAPI docs)
- Custom Documentation: Open `D:\PMO\API\docs\index.html` in your browser

## 📖 What's Included

### 🏠 Main Documentation (`index.html`)
- **Hero Section**: Beautiful landing with API overview
- **Quick Start**: Setup and basic usage examples
- **Core Endpoints**: 
  - Screener API (dynamic querying)
  - Projects API (CRUD operations)
  - Resources API (resource management)
- **Interactive Examples**: Copy-to-clipboard PowerShell examples
- **Response Samples**: Real JSON response examples

### 🔧 Modules Documentation (`modules.html`)
- **Business Lines**: Organizational hierarchy management
- **Managers**: Team structure and reporting
- **Resource Allocation**: Project staffing and capacity
- **Resource Roles**: Skills and role management
- **Resource Time Off**: Vacation and availability tracking
- **Database Utilities**: Connection and data access tools
- **Excel Import**: Bulk data import functionality
- **Testing & Debug Tools**: Development utilities

## ✨ Features

### 🎨 Modern Design
- **Responsive Layout**: Mobile-first design that works on all devices
- **Dark Theme**: Professional color scheme with excellent readability
- **Typography**: Clean, modern fonts with proper hierarchy
- **Icons**: Font Awesome icons throughout for visual clarity

### 🔍 Interactive Elements
- **Search Functionality**: Real-time search across all documentation
- **Copy-to-Clipboard**: One-click copying of code examples
- **Expandable Endpoints**: Click to expand/collapse endpoint details
- **Smooth Scrolling**: Seamless navigation between sections
- **Mobile Navigation**: Responsive hamburger menu for mobile devices

### 💻 Code Examples
- **PowerShell Examples**: Corrected `Invoke-WebRequest` syntax (not curl)
- **Syntax Highlighting**: Prism.js for beautiful code formatting
- **JSON Responses**: Real response examples with proper formatting
- **Multiple Languages**: PowerShell, JSON, Python examples

### 🧭 Navigation
- **Sticky Navbar**: Always accessible navigation
- **Sidebar Navigation**: Quick jump to any section
- **Auto-Active Links**: Navigation updates based on scroll position
- **Breadcrumbs**: Clear indication of current location

## 🛠️ Technical Details

### CSS Architecture
- **CSS Custom Properties**: Consistent theming system
- **Flexbox & Grid**: Modern layout techniques
- **Mobile-First**: Responsive design starting from mobile
- **Component-Based**: Reusable UI components

### JavaScript Features
- **Vanilla JS**: No framework dependencies
- **ES6+ Features**: Modern JavaScript syntax
- **Event Delegation**: Efficient event handling
- **Debounced Search**: Performance-optimized search
- **Local Storage**: Remembers user preferences

### Browser Support
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Fallbacks**: Graceful degradation for older browsers

## 📝 Content Organization

### API Endpoints Documented
1. **Screener API**
   - `POST /screener_projects_dynamic`
   - `POST /screener_resources_dynamic`
   - `POST /screener_resource_capacity_allocation_dynamic`

2. **Projects API**
   - `GET /projects` - List all projects
   - `POST /projects` - Create new project
   - `GET /projects/{id}` - Get specific project
   - `PUT /projects/{id}` - Update project
   - `DELETE /projects/{id}` - Delete project

3. **Resources API**
   - `GET /resources` - List all resources
   - `POST /resources` - Create new resource
   - `GET /resources/{id}` - Get specific resource
   - `PUT /resources/{id}` - Update resource

4. **Supporting Modules**
   - Business Lines, Managers, Resource Allocation
   - Resource Roles, Resource Time Off
   - Database utilities and Excel import tools

## 🎯 Usage Examples

### PowerShell Examples (Corrected Syntax)
```powershell
# Get all projects
Invoke-WebRequest -Uri "http://localhost:5000/projects" -Method GET | ConvertFrom-Json

# Create new project
$body = @{
    name = "New Project"
    description = "Project description"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/projects" -Method POST -Body $body -ContentType "application/json"

# Dynamic screener query
$query = @{
    conditions = @(
        @{
            field = "status"
            operator = "eq"
            value = "Active"
        }
    )
} | ConvertTo-Json -Depth 3

Invoke-WebRequest -Uri "http://localhost:5000/screener_projects_dynamic" -Method POST -Body $query -ContentType "application/json"
```

## 🔧 Customization

### Updating Content
1. **Add New Endpoints**: Edit `index.html` or `modules.html`
2. **Update Examples**: Modify the code blocks with new examples
3. **Change Styling**: Edit `assets/css/style.css`
4. **Add Functionality**: Extend `assets/js/script.js`

### Color Scheme
The CSS uses custom properties for easy theming:
```css
:root {
  --primary-color: #3b82f6;
  --secondary-color: #1e40af;
  --accent-color: #06b6d4;
  /* Update these to change the entire color scheme */
}
```

## 📱 Mobile Experience
- **Responsive Design**: Adapts to all screen sizes
- **Touch-Friendly**: Large tap targets and smooth interactions
- **Mobile Navigation**: Collapsible sidebar and hamburger menu
- **Optimized Performance**: Fast loading on mobile networks

## 🔍 Search Functionality
- **Real-Time Search**: Search as you type
- **Multi-Target**: Searches endpoints, descriptions, and content
- **Quick Navigation**: Click results to jump to sections
- **Keyboard Friendly**: Full keyboard navigation support

## 🚀 Performance
- **Lightweight**: Minimal dependencies
- **Fast Loading**: Optimized CSS and JavaScript
- **Efficient Search**: Debounced and optimized search algorithm
- **Lazy Features**: Features load only when needed

## 🔐 Security Notes
- **No Sensitive Data**: Documentation contains no API keys or secrets
- **Local First**: Can run entirely offline
- **Static Files**: No server-side vulnerabilities
- **CORS Friendly**: Works with any API configuration

## 📞 Support
For questions about the API or this documentation:
1. Check the examples in the documentation
2. Review the PowerShell syntax corrections
3. Examine the response format examples
4. Test endpoints with the provided examples

---

**Built with ❤️ for the PMO API**  
*Modern documentation for modern APIs*