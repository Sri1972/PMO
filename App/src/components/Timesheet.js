import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import '../styles/App.css';
import '../styles/Timesheet.css';

const Timesheet = () => {
    const [resources, setResources] = useState([]);
    const [selectedResourceId, setSelectedResourceId] = useState('');
    const [selectedResource, setSelectedResource] = useState(null);
    const [projects, setProjects] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [timesheetData, setTimesheetData] = useState([]);
    const [strategicPortfolios, setStrategicPortfolios] = useState({});
    const [productLines, setProductLines] = useState({});
    
    // Week selection state
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [expandedYears, setExpandedYears] = useState({ 2025: true });
    const [expandedMonths, setExpandedMonths] = useState({});
    const [weekData, setWeekData] = useState({});
    
    // Timesheet entries
    const [timeEntries, setTimeEntries] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    // Fetch resources on mount
    useEffect(() => {
        fetchResources();
        fetchProjects();
        generateWeeks();
    }, []);

    // Warn user about unsaved changes when leaving the page
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges]);

    // Fetch allocations and timesheet data when resource is selected
    useEffect(() => {
        if (selectedResourceId) {
            fetchAllocations(selectedResourceId);
            fetchTimesheetData(selectedResourceId);
        } else {
            setAllocations([]);
            setTimesheetData([]);
        }
    }, [selectedResourceId]);

    // Pre-populate timesheet when week and resource are selected
    useEffect(() => {
        if (selectedWeek && selectedResourceId && projects.length > 0) {
            populateTimesheetFromAllocations();
        } else if (selectedWeek && selectedResourceId) {
            setTimeEntries([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWeek, selectedResourceId, allocations, timesheetData, projects]);

    const fetchResources = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/resources`);
            const data = await response.json();
            setResources(data);
        } catch (error) {
            console.error('Error fetching resources:', error);
        }
    };

    const fetchProjects = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/projects`);
            const data = await response.json();
            setProjects(data);
            
            // Build portfolio and product line mappings
            const portfolios = {};
            const lines = {};
            data.forEach(project => {
                if (project.strategic_portfolio) {
                    portfolios[project.strategic_portfolio] = true;
                }
                if (project.product_line) {
                    lines[project.product_line] = true;
                }
            });
            setStrategicPortfolios(portfolios);
            setProductLines(lines);
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const fetchAllocations = async (resourceId) => {
        try {
            // Step 1: Get all allocations for the resource
            const response = await fetch(`${API_BASE_URL}/allocations/resource/${resourceId}`);
            const resourceAllocations = await response.json();
            
            if (!resourceAllocations || resourceAllocations.length === 0) {
                setAllocations([]);
                return;
            }

            // Step 2: Fetch capacity data for the entire year (weekly breakdown)
            const currentYear = new Date().getFullYear();
            const params = new URLSearchParams({
                resource_id: resourceId,
                start_date: `${currentYear}-01-01`,
                end_date: `${currentYear}-12-31`,
                interval: 'Weekly'
            });
            
            try {
                const capacityResponse = await fetch(
                    `${API_BASE_URL}/resource_capacity_allocation?${params.toString()}`
                );
                
                if (!capacityResponse.ok) {
                    console.error('Failed to fetch capacity data');
                    setAllocations(resourceAllocations);
                    return;
                }
                
                const capacityData = await capacityResponse.json();
                console.log('Capacity data received:', capacityData);
                
                // Enrich allocations with weekly capacity data
                const enrichedAllocations = resourceAllocations.map(allocation => {
                    // Find weekly breakdown for this specific project
                    const weeklyData = {};
                    
                    if (capacityData && Array.isArray(capacityData.data)) {
                        console.log(`Processing allocation for project ${allocation.project_id}`);
                        capacityData.data.forEach(weekInterval => {
                            if (weekInterval.project_allocation_details) {
                                const projectDetail = weekInterval.project_allocation_details.find(
                                    p => p.project_id === allocation.project_id
                                );
                                if (projectDetail) {
                                    console.log(`Found weekly data for ${weekInterval.start_date}:`, projectDetail);
                                    weeklyData[weekInterval.start_date] = {
                                        start_date: weekInterval.start_date,
                                        end_date: weekInterval.end_date,
                                        planned_hours: projectDetail.planned_hours,
                                        actual_hours: projectDetail.actual_hours
                                    };
                                }
                            }
                        });
                    }
                    
                    console.log(`Allocation ${allocation.allocation_id} weeklyData:`, weeklyData);
                    
                    return {
                        ...allocation,
                        weeklyData // Store weekly breakdown indexed by start_date
                    };
                });
                
                console.log('Enriched allocations:', enrichedAllocations);
                setAllocations(enrichedAllocations);
            } catch (err) {
                console.error('Error fetching capacity data:', err);
                setAllocations(resourceAllocations);
            }
        } catch (error) {
            console.error('Error fetching allocations:', error);
            setAllocations([]);
        }
    };

    const fetchTimesheetData = async (resourceId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/timesheet/${resourceId}`);
            if (!response.ok) {
                console.error('Failed to fetch timesheet data');
                setTimesheetData([]);
                return;
            }
            const data = await response.json();
            console.log('Timesheet data received:', data);
            setTimesheetData(data);
        } catch (error) {
            console.error('Error fetching timesheet data:', error);
            setTimesheetData([]);
        }
    };

    const handleResourceChange = (e) => {
        const resourceId = e.target.value;
        setSelectedResourceId(resourceId);
        const resource = resources.find(r => r.resource_id === parseInt(resourceId));
        setSelectedResource(resource);
        setTimeEntries([]); // Clear time entries when changing resource
    };

    // Generate week data for prev, current, and next year (Monday to Sunday weeks to match API)
    const generateWeeks = () => {
        const years = {};
        const currentYear = new Date().getFullYear();
        const yearsToGenerate = [currentYear - 1, currentYear, currentYear + 1];
        
        yearsToGenerate.forEach(year => {
            years[year] = {};
            for (let month = 0; month < 12; month++) {
                const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
                years[year][monthName] = [];
                
                // Start from the first day of the month
                let date = new Date(year, month, 1);
                
                // Find the first Monday of or before this month
                const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const daysToMonday = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days; otherwise go to previous Monday
                date.setDate(date.getDate() + daysToMonday);
                
                while (date.getMonth() <= month || (month === 11 && date.getMonth() === 0)) {
                    if (date.getFullYear() > year) break;
                    
                    const weekStart = new Date(date);
                    const weekEnd = new Date(date);
                    weekEnd.setDate(weekEnd.getDate() + 6); // Monday + 6 = Sunday
                    
                    // Include week if any part of it falls in this month
                    if (weekStart.getMonth() === month || weekEnd.getMonth() === month) {
                        if (weekStart.getFullYear() === year || weekEnd.getFullYear() === year) {
                            years[year][monthName].push({
                                start: new Date(weekStart),
                                end: new Date(weekEnd),
                                label: `Week ${weekStart.getDate()} - ${weekEnd.getDate()}`
                            });
                        }
                    }
                    
                    // Move to next Monday
                    date.setDate(date.getDate() + 7);
                    if (weekStart.getMonth() > month && weekStart.getFullYear() === year) break;
                }
            }
        });
        
        setWeekData(years);
        
        // Set only current year and current month as expanded by default
        const now = new Date();
        const currentMonthKey = `${currentYear}-${now.toLocaleString('default', { month: 'long' })}`;
        setExpandedYears({ [currentYear]: true });
        setExpandedMonths({ [currentMonthKey]: true });
    };

    const toggleYear = (year) => {
        setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
    };

    const toggleMonth = (year, month) => {
        const key = `${year}-${month}`;
        setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const selectWeek = (week) => {
        console.log('Selected week:', {
            start: week.start,
            end: week.end,
            startDay: week.start.toLocaleDateString('en-US', { weekday: 'long' }),
            endDay: week.end.toLocaleDateString('en-US', { weekday: 'long' }),
            startISO: formatDateISO(week.start),
            endISO: formatDateISO(week.end)
        });
        setSelectedWeek(week);
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatDateISO = (date) => {
        // Use local date to avoid timezone shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const populateTimesheetFromAllocations = useCallback(() => {
        if (!selectedWeek) {
            setTimeEntries([]);
            return;
        }

        const weekStart = selectedWeek.start;
        const weekEnd = selectedWeek.end;
        const weekStartISO = formatDateISO(weekStart);
        const weekEndISO = formatDateISO(weekEnd);
        
        console.log('Populating timesheet for week:', weekStartISO, 'to', weekEndISO);
        console.log('Available allocations:', allocations);
        console.log('Available timesheet data:', timesheetData);
        
        const weekStartDate = new Date(weekStart);
        const weekEndDate = new Date(weekEnd);
        
        // First, check if we have timesheet data for this week
        const timesheetForWeek = timesheetData.filter(ts => 
            ts.ts_start_date === weekStartISO && ts.ts_end_date === weekEndISO
        );
        
        console.log(`Found ${timesheetForWeek.length} timesheet entries for this week`);
        
        // Build entries, prioritizing timesheet data over allocations
        // Use a Map to combine hours for the same project
        const projectHoursMap = new Map();
        
        // First, add all timesheet entries (these take priority)
        timesheetForWeek.forEach((ts, index) => {
            const project = projects.find(p => p.project_id === ts.project_id);
            projectHoursMap.set(ts.project_id, {
                id: `timesheet-${ts.project_id}-${index}`,
                startDate: ts.ts_start_date,
                endDate: ts.ts_end_date,
                projectId: ts.project_id,
                project: ts.project_name,
                portfolio: project ? project.strategic_portfolio : '',
                productLine: project ? project.product_line : '',
                initiative: project ? project.initiative : '',
                hours: ts.weekly_project_hrs,
                isPrePopulated: true,
                source: 'timesheet' // Mark as coming from timesheet API
            });
        });
        
        // Then, add allocation data for projects not already in timesheet
        allocations.forEach((allocation, index) => {
            // Skip if this project already has timesheet data
            if (projectHoursMap.has(allocation.project_id)) {
                console.log(`Skipping allocation for project ${allocation.project_id} - timesheet data exists`);
                return;
            }
            // First check if this allocation's date range overlaps with the selected week
            const allocationStart = new Date(allocation.allocation_start_date);
            const allocationEnd = new Date(allocation.allocation_end_date);
            
            const weekOverlapsAllocation = (weekStartDate <= allocationEnd && weekEndDate >= allocationStart);
            
            if (!weekOverlapsAllocation) {
                console.log(`Allocation ${allocation.allocation_id} (${allocation.allocation_start_date} to ${allocation.allocation_end_date}) does not overlap with week ${weekStartISO} to ${weekEndISO}`);
                return;
            }
            
            let weekHours = 0;
            let foundWeek = false;
            
            console.log(`Checking allocation ${allocation.allocation_id} for project ${allocation.project_id}`);
            
            // Find the API week that overlaps with our selected week
            if (allocation.weeklyData) {
                for (const [apiWeekStart, weekData] of Object.entries(allocation.weeklyData)) {
                    const apiStart = new Date(apiWeekStart);
                    const apiEnd = new Date(weekData.end_date);
                    
                    // Check if the weeks overlap
                    if (apiStart <= weekEndDate && apiEnd >= weekStartDate) {
                        weekHours = weekData.planned_hours || 0;
                        foundWeek = true;
                        console.log(`Found ${weekHours} hours in API week ${apiWeekStart} to ${weekData.end_date}`);
                        break;
                    }
                }
            }
            
            // Only process if we found data for this week
            if (!foundWeek) {
                console.log(`No data for allocation ${allocation.allocation_id} in week ${weekStartISO}`);
                return;
            }
            
            const project = projects.find(p => p.project_id === allocation.project_id);
            const projectId = allocation.project_id;
            
            // If we already have an entry for this project, add to the hours
            // This handles the rare case where someone has overlapping allocations for the same project
            if (projectHoursMap.has(projectId)) {
                const existing = projectHoursMap.get(projectId);
                existing.hours += weekHours;
                console.log(`Adding ${weekHours} hours to existing project ${projectId}, total now: ${existing.hours}`);
            } else {
                // Create new entry
                projectHoursMap.set(projectId, {
                    id: `allocation-${allocation.allocation_id || index}`,
                    startDate: weekStartISO,
                    endDate: weekEndISO,
                    projectId: allocation.project_id,
                    project: project ? project.project_name : '',
                    portfolio: project ? project.strategic_portfolio : '',
                    productLine: project ? project.product_line : '',
                    initiative: project ? project.initiative : '',
                    hours: weekHours,
                    isPrePopulated: true,
                    source: 'allocation' // Mark as coming from allocation API
                });
            }
        });

        // Convert Map to array
        const entries = Array.from(projectHoursMap.values());
        
        console.log('Final entries:', entries);
        console.log('Entries by source:', {
            timesheet: entries.filter(e => e.source === 'timesheet').length,
            allocation: entries.filter(e => e.source === 'allocation').length
        });
        setTimeEntries(entries);
    }, [selectedWeek, allocations, timesheetData, projects]);

    const addNewRow = () => {
        if (!selectedWeek) return;
        
        const newEntry = {
            id: `new-${Date.now()}`,
            startDate: formatDateISO(selectedWeek.start),
            endDate: formatDateISO(selectedWeek.end),
            portfolio: '',
            productLine: '',
            projectId: '',
            project: '',
            initiative: '',
            hours: '',
            isPrePopulated: false
        };
        
        setTimeEntries(prev => [...prev, newEntry]);
        setHasChanges(true);
    };

    const updateEntry = (id, field, value) => {
        setTimeEntries(prev => prev.map(entry => {
            if (entry.id === id) {
                const updated = { ...entry, [field]: value };
                
                // Handle cascading dropdowns
                if (field === 'portfolio') {
                    // Reset dependent fields when portfolio changes
                    updated.productLine = '';
                    updated.projectId = '';
                    updated.project = '';
                    updated.initiative = '';
                } else if (field === 'productLine') {
                    // Reset dependent fields when product line changes
                    updated.projectId = '';
                    updated.project = '';
                    updated.initiative = '';
                } else if (field === 'projectId') {
                    // Auto-populate project details when project is selected
                    const project = projects.find(p => p.project_id === parseInt(value));
                    if (project) {
                        updated.project = project.project_name;
                        updated.portfolio = project.strategic_portfolio;
                        updated.productLine = project.product_line;
                        updated.initiative = project.initiative;
                    }
                }
                
                return updated;
            }
            return entry;
        }));
        setHasChanges(true);
    };

    const removeEntry = (id) => {
        setTimeEntries(prev => prev.filter(entry => entry.id !== id));
        setHasChanges(true);
    };

    const getTotalHours = () => {
        return timeEntries.reduce((sum, entry) => sum + (parseFloat(entry.hours) || 0), 0).toFixed(1);
    };

    const handleSave = async () => {
        if (!selectedResourceId || !selectedResource) {
            alert('Please select a resource');
            return;
        }

        if (timeEntries.length === 0) {
            alert('No timesheet entries to save');
            return;
        }

        // Validate all entries
        const invalidEntries = timeEntries.filter(entry => 
            !entry.projectId || !entry.project || entry.hours <= 0
        );

        if (invalidEntries.length > 0) {
            alert('Please complete all fields and ensure hours are greater than 0');
            return;
        }

        setIsSaving(true);

        try {
            // Submit each entry to the API
            const promises = timeEntries.map(async (entry) => {
                const formData = new FormData();
                formData.append('resource_id', selectedResourceId);
                formData.append('resource_name', selectedResource.resource_name);
                formData.append('resource_email_id', selectedResource.resource_email);
                formData.append('project_id', entry.projectId);
                formData.append('project_name', entry.project);
                formData.append('ts_start_date', entry.startDate);
                formData.append('ts_end_date', entry.endDate);
                formData.append('weekly_project_hrs', entry.hours);

                const response = await fetch(`${API_BASE_URL}/timesheet/upsert`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to save timesheet entry');
                }

                return response.json();
            });

            await Promise.all(promises);

            // Show success message
            setSaveMessage('Timesheet saved successfully!');
            setTimeout(() => setSaveMessage(''), 3000);
            setHasChanges(false);

            // Reload both allocation and timesheet data to reflect saved changes
            if (selectedWeek && selectedResourceId) {
                await fetchAllocations(selectedResourceId);
                await fetchTimesheetData(selectedResourceId);
            }
        } catch (error) {
            console.error('Error saving timesheet:', error);
            setSaveMessage(`Error: ${error.message}`);
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (hasChanges) {
            // Show custom confirmation modal
            const modal = document.createElement('div');
            modal.className = 'custom-confirm-modal';
            modal.innerHTML = `
                <div class="custom-confirm-overlay"></div>
                <div class="custom-confirm-box">
                    <div class="custom-confirm-icon">⚠️</div>
                    <h3>Unsaved Changes</h3>
                    <p>You have unsaved changes. Do you want to discard them?</p>
                    <div class="custom-confirm-buttons">
                        <button class="custom-confirm-cancel">Stay on Page</button>
                        <button class="custom-confirm-ok">Discard Changes</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const okBtn = modal.querySelector('.custom-confirm-ok');
            const cancelBtn = modal.querySelector('.custom-confirm-cancel');

            okBtn.onclick = () => {
                // Reload the original data
                if (selectedWeek && selectedResourceId) {
                    populateTimesheetFromAllocations();
                }
                setHasChanges(false);
                document.body.removeChild(modal);
            };

            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
            };
        }
    };

    // Get unique portfolios from projects
    const getUniquePortfolios = () => {
        const portfolios = [...new Set(projects.map(p => p.strategic_portfolio).filter(Boolean))];
        return portfolios.sort();
    };

    // Get product lines filtered by portfolio
    const getProductLinesByPortfolio = (portfolio) => {
        if (!portfolio) return [];
        const lines = [...new Set(
            projects
                .filter(p => p.strategic_portfolio === portfolio)
                .map(p => p.product_line)
                .filter(Boolean)
        )];
        return lines.sort();
    };

    // Get projects filtered by portfolio and product line
    const getProjectsByFilters = (portfolio, productLine) => {
        return projects.filter(p => {
            if (portfolio && p.strategic_portfolio !== portfolio) return false;
            if (productLine && p.product_line !== productLine) return false;
            return true;
        });
    };

    return (
        <div className="timesheet-container">
            {/* Resource Selector at Top */}
            <div className="timesheet-header">
                <div className="resource-selector">
                    <label htmlFor="resource-select">Select Resource:</label>
                    <select 
                        id="resource-select"
                        value={selectedResourceId} 
                        onChange={handleResourceChange}
                        className="resource-dropdown"
                    >
                        <option value="">-- Select a Resource --</option>
                        {resources.map(resource => (
                            <option key={resource.resource_id} value={resource.resource_id}>
                                {resource.resource_name} ({resource.resource_email})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="timesheet-content">
                {/* Left Panel - Week Selector */}
                <div className="week-selector-panel">
                    <div className="panel-header">
                        <h3>Select Week</h3>
                    </div>
                    
                    <div className="week-tree">
                        {Object.keys(weekData).sort((a, b) => a - b).map(year => (
                            <div key={year} className="year-section">
                                <button
                                    onClick={() => toggleYear(parseInt(year))}
                                    className="tree-toggle year-toggle"
                                >
                                    <span className="toggle-icon">
                                        {expandedYears[year] ? '▼' : '▶'}
                                    </span>
                                    <span className="year-label">{year}</span>
                                </button>
                                
                                {expandedYears[year] && (
                                    <div className="month-list">
                                        {Object.keys(weekData[year]).map(month => {
                                            const monthKey = `${year}-${month}`;
                                            return (
                                                <div key={monthKey} className="month-section">
                                                    <button
                                                        onClick={() => toggleMonth(parseInt(year), month)}
                                                        className="tree-toggle month-toggle"
                                                    >
                                                        <span className="toggle-icon">
                                                            {expandedMonths[monthKey] ? '▼' : '▶'}
                                                        </span>
                                                        <span className="month-label">{month}</span>
                                                    </button>
                                                    
                                                    {expandedMonths[monthKey] && (
                                                        <div className="week-list">
                                                            {weekData[year][month].map((week, idx) => {
                                                                const isSelected = selectedWeek && 
                                                                    selectedWeek.start.getTime() === week.start.getTime();
                                                                return (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => selectWeek(week)}
                                                                        className={`week-button ${isSelected ? 'selected' : ''}`}
                                                                    >
                                                                        {formatDate(week.start)} - {formatDate(week.end)}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel - Timesheet Entries */}
                <div className="timesheet-entries-panel">
                    <div className="entries-header">
                        <div>
                            <h2>Project Timesheet</h2>
                            {selectedWeek && (
                                <p className="week-display">
                                    Week: {formatDate(selectedWeek.start)} - {formatDate(selectedWeek.end)}
                                </p>
                            )}
                            {selectedResource && (
                                <p className="resource-display">
                                    Resource: {selectedResource.resource_name}
                                </p>
                            )}
                        </div>
                        
                        <button
                            onClick={addNewRow}
                            disabled={!selectedWeek || !selectedResourceId}
                            className="btn btn-primary add-project-btn"
                        >
                            + Add Project Row
                        </button>
                    </div>

                    {!selectedWeek ? (
                        <div className="empty-state">
                            <p>Select a week from the left panel to start adding time entries</p>
                        </div>
                    ) : !selectedResourceId ? (
                        <div className="empty-state">
                            <p>Select a resource from the dropdown above to view/add timesheet entries</p>
                        </div>
                    ) : timeEntries.length === 0 ? (
                        <div className="empty-state">
                            <p>No time entries for this week. Click "Add Project Row" to add entries.</p>
                        </div>
                    ) : (
                        <>
                            <div className="timesheet-table-container">
                                <table className="timesheet-table">
                                    <thead>
                                        <tr>
                                            <th>Colleague Name</th>
                                            <th>Start Date</th>
                                            <th>End Date</th>
                                            <th>Portfolio</th>
                                            <th>Product Line</th>
                                            <th>Project ID</th>
                                            <th>Project</th>
                                            <th>Initiative</th>
                                            <th>Hours</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeEntries.map(entry => {
                                            const availableProductLines = getProductLinesByPortfolio(entry.portfolio);
                                            const availableProjects = getProjectsByFilters(entry.portfolio, entry.productLine);
                                            
                                            return (
                                                <tr key={entry.id} className={entry.isPrePopulated ? 'prepopulated-row' : ''}>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={selectedResource ? selectedResource.resource_name : ''}
                                                            readOnly
                                                            className="text-input readonly"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="date"
                                                            value={entry.startDate}
                                                            readOnly
                                                            className="date-input readonly"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="date"
                                                            value={entry.endDate}
                                                            readOnly
                                                            className="date-input readonly"
                                                        />
                                                    </td>
                                                    <td>
                                                        {entry.isPrePopulated ? (
                                                            <input
                                                                type="text"
                                                                value={entry.portfolio}
                                                                readOnly
                                                                className="text-input readonly"
                                                            />
                                                        ) : (
                                                            <select
                                                                value={entry.portfolio}
                                                                onChange={(e) => updateEntry(entry.id, 'portfolio', e.target.value)}
                                                                className="project-select"
                                                            >
                                                                <option value="">Select Portfolio...</option>
                                                                {getUniquePortfolios().map(portfolio => (
                                                                    <option key={portfolio} value={portfolio}>
                                                                        {portfolio}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {entry.isPrePopulated ? (
                                                            <input
                                                                type="text"
                                                                value={entry.productLine}
                                                                readOnly
                                                                className="text-input readonly"
                                                            />
                                                        ) : (
                                                            <select
                                                                value={entry.productLine}
                                                                onChange={(e) => updateEntry(entry.id, 'productLine', e.target.value)}
                                                                className="project-select"
                                                                disabled={!entry.portfolio}
                                                            >
                                                                <option value="">Select Product Line...</option>
                                                                {availableProductLines.map(line => (
                                                                    <option key={line} value={line}>
                                                                        {line}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={entry.projectId || ''}
                                                            readOnly
                                                            className="text-input readonly small-input"
                                                        />
                                                    </td>
                                                    <td>
                                                        {entry.isPrePopulated ? (
                                                            <input
                                                                type="text"
                                                                value={entry.project}
                                                                readOnly
                                                                className="text-input readonly"
                                                            />
                                                        ) : (
                                                            <select
                                                                value={entry.projectId}
                                                                onChange={(e) => updateEntry(entry.id, 'projectId', e.target.value)}
                                                                className="project-select"
                                                                disabled={!entry.portfolio || !entry.productLine}
                                                            >
                                                                <option value="">Select Project...</option>
                                                                {availableProjects.map(project => (
                                                                    <option key={project.project_id} value={project.project_id}>
                                                                        {project.project_name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={entry.initiative}
                                                            readOnly
                                                            className="text-input readonly"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            value={entry.hours}
                                                            onChange={(e) => updateEntry(entry.id, 'hours', e.target.value)}
                                                            placeholder="0"
                                                            min="0"
                                                            max="168"
                                                            step="0.5"
                                                            className="hours-input"
                                                        />
                                                    </td>
                                                    <td>
                                                        <button
                                                            onClick={() => removeEntry(entry.id)}
                                                            className="btn-delete"
                                                            title="Delete row"
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '4px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                width="16"
                                                                height="16"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="#dc2626"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                
                                {timeEntries.length > 0 && (
                                    <div className="timesheet-footer">
                                        <div className="total-hours">
                                            <strong>Total Hours:</strong> {getTotalHours()}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="timesheet-actions">
                                <button 
                                    onClick={handleSave} 
                                    className="save-btn"
                                    disabled={!hasChanges || isSaving || timeEntries.length === 0}
                                >
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button 
                                    onClick={handleCancel} 
                                    className="cancel-btn"
                                    disabled={!hasChanges || isSaving}
                                >
                                    Cancel
                                </button>
                                
                                {saveMessage && (
                                    <div className={`save-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}>
                                        {saveMessage}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Timesheet;
