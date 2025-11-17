from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from business_lines import business_lines_router
from managers import managers_router
from resources import resources_router
from resource_timeoff import timeoff_router
from resource_roles import roles_router
from resource_allocation import allocation_router
from resource_allocation_actual import allocation_actual_router
from projects import projects_router
from excel_to_db import excel_to_db_router
from screener import screener_router

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust origins as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the configuration file as a static file
app.mount("/static", StaticFiles(directory="D:\SourceCode\PMO\API"), name="static")

# Include routers
app.include_router(business_lines_router, tags=["Business Lines"])
app.include_router(managers_router, prefix="", tags=["Managers"])
app.include_router(resources_router, prefix="", tags=["Resources"])
app.include_router(timeoff_router, prefix="", tags=["Time Off"])
app.include_router(roles_router, prefix="", tags=["Resource Roles"])
app.include_router(allocation_router, prefix="", tags=["Allocations"])
app.include_router(allocation_actual_router, prefix="", tags=["Resource Allocation Actual"])
app.include_router(projects_router, tags=["Projects"])
app.include_router(excel_to_db_router, prefix="", tags=["Excel Import"])
app.include_router(screener_router, prefix="", tags=["Screener / Query Builder"])

# Root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the PMO API"}
