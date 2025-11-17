# Screener Service - Query Builder Guide

## Overview

The Screener service is a powerful dynamic query builder that allows you to:

1. **Filter data dynamically** - both on database fields and calculated fields
2. **Select response fields** - choose exactly which fields you want in the response
3. **Two-stage filtering** - Pre-query (database) and post-query (calculated) filters
4. **Nested filtering** - filter items within arrays (e.g., resources within a project)

## Key Concepts

### Pre-Query Filters (Database Filters)
Applied **before** data is retrieved from the database. Use for fields that exist in the database.

**Example:** `project_id`, `strategic_portfolio`, `product_line`, `resource_type`

### Post-Query Filters (Calculated Field Filters)
Applied **after** data is retrieved and calculated. Use for derived/computed fields.

**Example:** `allocation_hours_planned`, `allocation_hours_actual`, `available_capacity`, `allocation_cost_planned`

## Available Endpoints

### 1. Universal Screener (Recommended)
**POST** `/screener_universal`

The most flexible endpoint - works with any screener method and applies post-query filtering.

**Example Request:**
```json
{
  "endpoint": "resource_capacity_allocation_per_portfolio",
  "params": {
    "strategic_portfolio": "Market & Sell",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "interval": "Monthly"
  },
  "post_filters": [
    {"field": "total_capacity", "operator": ">", "value": 100},
    {"field": "available_capacity", "operator": "<", "value": 50}
  ],
  "response_fields": ["interval", "total_capacity", "allocation_hours_planned", "available_capacity"],
  "nested_filters": {
    "resources": [
      {"field": "resource_role", "operator": "=", "value": "Full Stack Developer"}
    ]
  }
}
```

**Use Cases:**
- Filter portfolio data by total capacity > 100 hours
- Show only months where available capacity < 50 hours
- Filter resources by role within the results

---

### 2. Dynamic Project Screener
**POST** `/screener_projects_dynamic`

Filter projects with flexible conditions and field selection.

**Example Request:**
```json
{
  "filters": [
    {"column": "strategic_portfolio", "operator": "=", "value": "Market & Sell"},
    {"column": "current_status", "operator": "=", "value": "Active"}
  ],
  "logical_operator": "AND",
  "fields": [
    "project_id",
    "project_name",
    "strategic_portfolio",
    "product_line",
    "current_status",
    "resource_hours_planned"
  ]
}
```

**Advanced Filtering:**
```json
{
  "filters": [
    {"column": "strategic_portfolio", "operator": "=", "value": "Market & Sell"},
    {"column": "start_date_est", "operator": ">=", "value": "2025-01-01"},
    {"column": "resource_hours_planned", "operator": ">", "value": 100}
  ],
  "logical_operator": "AND",
  "fields": ["all"]
}
```

**Available Fields:**
- Database: `project_id`, `project_name`, `strategic_portfolio`, `product_line`, `current_status`, `rag_status`, etc.
- Computed: `resource_hours_planned`, `resource_cost_planned`, `resource_hours_actual`, `resource_cost_actual`

---

### 3. Dynamic Resource Capacity Allocation
**POST** `/screener_resource_capacity_allocation_dynamic`

Query multiple resources with post-query filtering on calculated metrics.

**Example Request:**
```json
{
  "resource_ids": [1, 2, 3],
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "interval": "Monthly",
  "pre_filters": [
    {"field": "project_id", "operator": "=", "value": 2}
  ],
  "post_filters": [
    {"field": "allocation_hours_planned", "operator": ">", "value": 10},
    {"field": "available_capacity", "operator": "<", "value": 100}
  ],
  "response_fields": [
    "start_date",
    "end_date",
    "total_capacity",
    "allocation_hours_planned",
    "available_capacity"
  ]
}
```

**Use Cases:**
- Find months where planned allocation > 10 hours
- Show only periods where available capacity < 100 hours
- Filter by specific project at database level

---

### 4. Dynamic Project Capacity Allocation
**POST** `/screener_project_capacity_allocation_dynamic`

Query multiple projects with filtering on both interval and resource detail levels.

**Example Request:**
```json
{
  "project_ids": [1, 2, 3],
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "interval": "Monthly",
  "post_filters": [
    {"field": "allocation_hours_planned", "operator": ">", "value": 50}
  ],
  "resource_detail_filters": [
    {"field": "resource_role", "operator": "=", "value": "Full Stack Developer"},
    {"field": "allocation_hours_planned", "operator": ">", "value": 10}
  ],
  "response_fields": [
    "start_date",
    "end_date",
    "total_capacity",
    "allocation_hours_planned",
    "resource_details"
  ]
}
```

**Use Cases:**
- Show only intervals with planned hours > 50
- Filter resources to only Full Stack Developers
- Filter resources with allocation > 10 hours

---

## Filter Operators

All endpoints support these operators:

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `{"field": "status", "operator": "=", "value": "Active"}` |
| `!=` | Not equals | `{"field": "status", "operator": "!=", "value": "Closed"}` |
| `>` | Greater than | `{"field": "hours", "operator": ">", "value": 100}` |
| `<` | Less than | `{"field": "capacity", "operator": "<", "value": 50}` |
| `>=` | Greater than or equal | `{"field": "hours", "operator": ">=", "value": 40}` |
| `<=` | Less than or equal | `{"field": "capacity", "operator": "<=", "value": 200}` |
| `LIKE` | Pattern match (case-insensitive) | `{"field": "name", "operator": "LIKE", "value": "Developer"}` |

---

## Common Use Cases

### Use Case 1: Find Overallocated Resources
Find resources where planned hours exceed 80% of capacity:

```json
{
  "endpoint": "resource_capacity_allocation",
  "params": {
    "resource_id": 1,
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "interval": "Monthly"
  },
  "post_filters": [
    {"field": "allocation_hours_planned", "operator": ">", "value": 120}
  ]
}
```

### Use Case 2: Find Projects by Role and Capacity
Find projects that need Full Stack Developers with > 20 hours allocation:

```json
{
  "project_ids": [1, 2, 3, 4, 5],
  "interval": "Monthly",
  "resource_detail_filters": [
    {"field": "resource_role", "operator": "=", "value": "Full Stack Developer"},
    {"field": "allocation_hours_planned", "operator": ">", "value": 20}
  ],
  "response_fields": ["project_name", "resource_details"]
}
```

### Use Case 3: Portfolio Capacity Dashboard
Show portfolio capacity with only periods that have low availability:

```json
{
  "endpoint": "resource_capacity_allocation_per_portfolio",
  "params": {
    "strategic_portfolio": "Market & Sell",
    "interval": "Monthly"
  },
  "post_filters": [
    {"field": "available_capacity", "operator": "<", "value": 100}
  ],
  "response_fields": [
    "interval",
    "total_capacity",
    "allocation_hours_planned",
    "available_capacity"
  ]
}
```

### Use Case 4: Active Projects by Portfolio with Budget
Find active projects in a portfolio with planned hours > 100:

```json
{
  "filters": [
    {"column": "strategic_portfolio", "operator": "=", "value": "Market & Sell"},
    {"column": "current_status", "operator": "=", "value": "Active"}
  ],
  "logical_operator": "AND",
  "fields": [
    "project_id",
    "project_name",
    "strategic_portfolio",
    "current_status",
    "resource_hours_planned",
    "resource_cost_planned"
  ]
}
```

Then apply post-query filter (if using universal screener):
```json
{
  "post_filters": [
    {"field": "resource_hours_planned", "operator": ">", "value": 100}
  ]
}
```

---

## Metadata Endpoints

### Get Available Fields
**GET** `/screener_available_fields`

Returns all available fields for projects and resources with descriptions.

### Get Field Values
**GET** `/screener_field_values/{entity_type}/{field_name}`

Get distinct values for dropdown population.

**Examples:**
- `/screener_field_values/project/strategic_portfolio`
- `/screener_field_values/resource/resource_role`

---

## Best Practices

1. **Use Pre-Query Filters When Possible**
   - Faster performance (database-level filtering)
   - Use for fields that exist in the database

2. **Use Post-Query Filters for Calculated Fields**
   - Required for computed metrics (hours, costs, availability)
   - Applied after all calculations

3. **Select Only Needed Fields**
   - Reduces response size
   - Improves performance
   - Use `response_fields` parameter

4. **Combine Filters Strategically**
   - Pre-filter at database level (strategic_portfolio, project_id)
   - Post-filter on calculations (allocation_hours_planned > 50)
   - Nested filter for array elements (filter resources within projects)

5. **Use Universal Screener for Complex Queries**
   - Most flexible option
   - Supports all filtering capabilities
   - Works with any endpoint

---

## UI Implementation Guide

### Building a Dynamic Screener UI

1. **Field Selection Dropdown**
   ```javascript
   // Fetch available fields
   GET /screener_available_fields
   
   // Populate dropdown with field names
   ```

2. **Filter Builder**
   ```javascript
   // Allow users to add multiple filters
   // Each filter has: field, operator, value
   
   const filters = [
     { field: "strategic_portfolio", operator: "=", value: "Market & Sell" },
     { field: "current_status", operator: "=", value: "Active" }
   ];
   ```

3. **Response Field Selector**
   ```javascript
   // Multi-select checkbox for fields to display
   const selectedFields = [
     "project_id",
     "project_name",
     "resource_hours_planned"
   ];
   ```

4. **Execute Query**
   ```javascript
   POST /screener_projects_dynamic
   {
     "filters": filters,
     "fields": selectedFields,
     "logical_operator": "AND"
   }
   ```

---

## Error Handling

All endpoints return standard HTTP status codes:

- `200` - Success
- `400` - Bad request (invalid parameters)
- `404` - Resource not found
- `500` - Server error

**Example Error Response:**
```json
{
  "detail": "Invalid field name for projects: invalid_field"
}
```

---

## Performance Tips

1. **Limit Date Ranges**
   - Smaller date ranges = faster queries
   - Use specific date ranges instead of full year when possible

2. **Use Pre-Filters**
   - Database-level filtering is faster than post-query
   - Filter by `project_id` or `resource_id` when possible

3. **Select Fewer Fields**
   - Don't request all fields if you only need a few
   - Use `response_fields` to limit data transfer

4. **Batch Queries Wisely**
   - Don't query 100 projects at once
   - Consider pagination for large result sets

---

## Examples by Scenario

### Scenario: Resource Availability Report
Show all resources with < 50 hours available capacity in Q1 2025:

```json
POST /screener_universal
{
  "endpoint": "resource_capacity_allocation",
  "params": {
    "resource_id": 1,
    "start_date": "2025-01-01",
    "end_date": "2025-03-31",
    "interval": "Monthly"
  },
  "post_filters": [
    {"field": "available_capacity", "operator": "<", "value": 50}
  ],
  "response_fields": [
    "start_date",
    "end_date",
    "total_capacity",
    "allocation_hours_planned",
    "available_capacity"
  ]
}
```

### Scenario: High-Value Project Dashboard
Show active projects with > $10k in planned costs:

```json
POST /screener_projects_dynamic
{
  "filters": [
    {"column": "current_status", "operator": "=", "value": "Active"}
  ],
  "fields": [
    "project_id",
    "project_name",
    "strategic_portfolio",
    "resource_hours_planned",
    "resource_cost_planned"
  ]
}
```

Then filter results where `resource_cost_planned > 10000` on the client side, or use the universal screener with post_filters.

---

## Support

For questions or issues, consult the FastAPI automatic documentation at:
- **http://localhost:5000/docs** (Swagger UI)
- **http://localhost:5000/redoc** (ReDoc)

These provide interactive API testing and full schema documentation.
