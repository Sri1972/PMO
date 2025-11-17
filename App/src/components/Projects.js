import React, { useEffect, useState, useCallback } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ModuleRegistry } from '@ag-grid-community/core';
import { API_BASE_URL } from '../config';
import { FaFileExcel, FaPaperclip } from 'react-icons/fa'; // Import paperclip icon
import * as XLSX from 'xlsx'; // Import XLSX for Excel export
import { Tooltip, message, Modal, Button } from 'antd'; // Import Tooltip, message, Modal, and Button
import ProjectsModal from './ProjectsModal';
import { Line, Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'chart.js';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import ResourceTooltip from './ResourceTooltip'; // Import the custom tooltip component

ModuleRegistry.registerModules([ClientSideRowModelModule]);
Chart.register(annotationPlugin);

const Projects = () => {
    const navigate = useNavigate(); // Initialize navigate
    const [rowData, setRowData] = useState([]);
    const [strategicPortfolios, setStrategicPortfolios] = useState([]);
    const [productLines, setProductLines] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [isUpdateButtonEnabled, setIsUpdateButtonEnabled] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [barChartData, setBarChartData] = useState(null);
    const [lineChartData, setLineChartData] = useState(null);
    const [costLineChartData, setCostLineChartData] = useState(null); // Add state for cost line chart data
    const [activeTab, setActiveTab] = useState('Charts');
    const [activeSubTab, setActiveSubTab] = useState('Hours'); // State for active subtab under Charts
    const [timelines, setTimelines] = useState([{ milestone: '', start_date: '', end_date: '' }]);
    const [deletedTimelines, setDeletedTimelines] = useState([]);
    const [gridApi, setGridApi] = useState(null); // Add state for gridApi
    const [lineChartInterval, setLineChartInterval] = useState('Weekly'); // State for interval toggle
    const [dynamicColumnDefs, setDynamicColumnDefs] = useState([]); // State for dynamically generated columns
    const [columnDefs, setColumnDefs] = useState([]); // Move columnDefs to state for dynamic updates
    const [isOverlayVisible, setIsOverlayVisible] = useState(false); // State to control overlay visibility
    const [parsedExcelData, setParsedExcelData] = useState([]); // State to store parsed Excel data
    const [excelColumnDefs, setExcelColumnDefs] = useState([]); // State to store column definitions for the overlay grid
    // Add state for resource-level line chart data
    const [resourceLineChartsData, setResourceLineChartsData] = useState([]);

    const milestoneOptions = [
        "Project Kick-off",
        "Requirements",
        "Design",
        "CAR",
        "POC",
        "Infrastructure Setup - Dev",
        "Infrastructure Setup - QA",
        "Infrastructure Setup - UAT/Beta",
        "Infrastructure Setup - PROD",
        "Infrastructure Setup - DR",
        "Development",
        "QA",
        "UAT",
        "TechOps/SRE Transition",
        "Go Live"
    ];

    const generateDynamicColumnsAndData = (projects) => {
        const allRoles = new Set();

        // Collect all unique roles across all projects
        projects.forEach((project) => {
            const resourceRoleSummary = project.resource_role_summary || {};
            Object.keys(resourceRoleSummary).forEach((role) => {
                allRoles.add(role);
            });
        });

        // Generate dynamic columns based on all roles
        const roleColumns = Array.from(allRoles).map((role) => ({
            headerName: role,
            children: [
                {
                    headerName: 'Hours Planned',
                    field: `${role}_hours_planned`,
                    valueGetter: (params) => {
                        const value = params.data.resource_role_summary?.[role]?.total_resource_hours_planned || 0;
                        return value; // Show nothing if value is 0
                    },
                    tooltipValueGetter: (params) => {
                        const resources = params.data.resource_role_summary?.[role]?.resources_details || [];
                        if (resources.length === 0) return 'No Allocation'; // Show "No Allocation" if no resources
                        return resources
                            .map(
                                (r, index) =>
                                    `${index + 1}. ${r.resource_name} (${r.resource_email}) - ${r.resource_hours_planned} Hrs.`
                            )
                            .join('\n');
                    },
                },
                {
                    headerName: 'Hours Actual',
                    field: `${role}_hours_actual`,
                    valueGetter: (params) => {
                        const value = params.data.resource_role_summary?.[role]?.total_resource_hours_actual || 0;
                        return value; // Show nothing if value is 0
                    },
                    tooltipValueGetter: (params) => {
                        const resources = params.data.resource_role_summary?.[role]?.resources_details || [];
                        if (resources.length === 0) return 'No Allocation'; // Show "No Allocation" if no resources
                        return resources
                            .map(
                                (r, index) =>
                                    `${index + 1}. ${r.resource_name} (${r.resource_email}) - ${r.resource_hours_actual} Hrs.`
                            )
                            .join('\n');
                    },
                },
                {
                    headerName: 'Cost Planned',
                    field: `${role}_cost_planned`,
                    valueGetter: (params) => {
                        const value = params.data.resource_role_summary?.[role]?.total_resource_cost_planned || 0;
                        return value; // Show nothing if value is 0
                    },
                    tooltipValueGetter: (params) => {
                        const resources = params.data.resource_role_summary?.[role]?.resources_details || [];
                        if (resources.length === 0) return 'No Allocation'; // Show "No Allocation" if no resources
                        return resources
                            .map(
                                (r, index) =>
                                    `${index + 1}. ${r.resource_name} (${r.resource_email}) - $${r.resource_cost_planned.toFixed(2)}`
                            )
                            .join('\n');
                    },
                },
                {
                    headerName: 'Cost Actual',
                    field: `${role}_cost_actual`,
                    valueGetter: (params) => {
                        const value = params.data.resource_role_summary?.[role]?.total_resource_cost_actual || 0;
                        return value; // Show nothing if value is 0
                    },
                    tooltipValueGetter: (params) => {
                        const resources = params.data.resource_role_summary?.[role]?.resources_details || [];
                        if (resources.length === 0) return 'No Allocation'; // Show "No Allocation" if no resources
                        return resources
                            .map(
                                (r, index) =>
                                    `${index + 1}. ${r.resource_name} (${r.resource_email}) - $${r.resource_cost_actual.toFixed(2)}`
                            )
                            .join('\n');
                    },
                },
            ],
        }));

        const baseColumnDefs = [
            { headerName: 'Project ID', field: 'project_id' },
            { headerName: 'Project Name', field: 'project_name' },
            { headerName: 'Strategic Portfolio', field: 'strategic_portfolio' },
            { headerName: 'Product Line', field: 'product_line' },
            { headerName: 'Project Type', field: 'project_type' },
            { headerName: 'Project Description', field: 'project_description' },
            { headerName: 'Vitality', field: 'vitality' },
            { headerName: 'Strategic', field: 'strategic' },
            { headerName: 'Aim', field: 'aim' },
            { headerName: 'Timesheet Project Name', field: 'timesheet_project_name' },
            { headerName: 'Technology Project', field: 'technology_project' },
            {
                headerName: 'Est. Revenue',
                children: [
                    { headerName: 'Growth PA', field: 'revenue_est_growth_pa' },
                    { headerName: 'Current Year', field: 'revenue_est_current_year' },
                    { headerName: 'Current Year +1', field: 'revenue_est_current_year_plus_1' },
                    { headerName: 'Current Year +2', field: 'revenue_est_current_year_plus_2' },
                    { headerName: 'Current Year +3', field: 'revenue_est_current_year_plus_3' },
                ],
            },
            { headerName: 'Start Date Est.', field: 'start_date_est' },
           
            { headerName: 'Start Date Actual', field: 'start_date_actual' },
            { headerName: 'End Date Actual', field: 'end_date_actual' },
            { headerName: 'Current Status', field: 'current_status' },
            { headerName: 'RAG Status', field: 'rag_status' },
            { headerName: 'Comments', field: 'comments' },
            { headerName: 'Added By', field: 'added_by' },
            { headerName: 'Added Date', field: 'added_date' },
            { headerName: 'Updated By', field: 'updated_by' },
            { headerName: 'Updated Date', field: 'updated_date' },
            {
                headerName: 'Total Project Hours',
                children: [
                    {
                        headerName: 'Planned',
                        field: 'project_resource_hours_planned',
                        valueGetter: (params) => {
                            const value = params.data.project_resource_hours_planned || 0;
                            return value; // Show nothing if value is 0
                        },
                        tooltipValueGetter: (params) => {
                            const resourceRoleSummary = params.data.resource_role_summary || {};
                            return Object.entries(resourceRoleSummary)
                                .map(([role, details]) => {
                                    const resources = details.resources_details || [];
                                    return resources
                                        .map(
                                            (r, index) =>
                                                `${index + 1}. ${r.resource_name} (${r.resource_email}) - ${r.resource_hours_planned} Hrs.`
                                        )
                                        .join('\n');
                                })
                                .join('\n\n') || 'No Allocation';
                        },
                    },
                    {
                        headerName: 'Actual',
                        field: 'project_resource_hours_actual',
                        valueGetter: (params) => {
                            const value = params.data.project_resource_hours_actual || 0;
                            return value; // Show nothing if value is 0
                        },
                        tooltipValueGetter: (params) => {
                            const resourceRoleSummary = params.data.resource_role_summary || {};
                            return Object.entries(resourceRoleSummary)
                                .map(([role, details]) => {
                                    const resources = details.resources_details || [];
                                    return resources
                                        .map(
                                            (r, index) =>
                                                `${index + 1}. ${r.resource_name} (${r.resource_email}) - ${r.resource_hours_actual} Hrs.`
                                        )
                                        .join('\n');
                                })
                                .join('\n\n') || 'No Allocation';
                        },
                    },
                ],
            },
            {
                headerName: 'Total Project Cost',
                children: [
                    {
                        headerName: 'Planned',
                        field: 'project_resource_cost_planned',
                        valueGetter: (params) => {
                            const value = params.data.project_resource_cost_planned || 0;
                            return value; // Show nothing if value is 0
                        },
                        tooltipValueGetter: (params) => {
                            const resourceRoleSummary = params.data.resource_role_summary || {};
                            return Object.entries(resourceRoleSummary)
                                .map(([role, details]) => {
                                    const resources = details.resources_details || [];
                                    return resources
                                        .map(
                                            (r, index) =>
                                                `${index + 1}. ${r.resource_name} (${r.resource_email}) - $${r.resource_cost_planned.toFixed(2)}`
                                        )
                                        .join('\n');
                                })
                                .join('\n\n') || 'No Allocation';
                        },
                    },
                    {
                        headerName: 'Actual',
                        field: 'project_resource_cost_actual',
                        valueGetter: (params) => {
                            const value = params.data.project_resource_cost_actual || 0;
                            return value; // Show nothing if value is 0
                        },
                        tooltipValueGetter: (params) => {
                            const resourceRoleSummary = params.data.resource_role_summary || {};
                            return Object.entries(resourceRoleSummary)
                                .map(([role, details]) => {
                                    const resources = details.resources_details || [];
                                    return resources
                                        .map(
                                            (r, index) =>
                                                `${index + 1}. ${r.resource_name} (${r.resource_email}) - $${r.resource_cost_actual.toFixed(2)}`
                                        )
                                        .join('\n');
                                })
                                .join('\n\n') || 'No Allocation';
                        },
                    },
                ],
            },
        ];

        return [...baseColumnDefs, ...roleColumns];
    };

    const defaultColDef = {
        sortable: true,
        filter: true,
        resizable: true,
        tooltipComponent: 'resourceTooltip', // Use the custom tooltip component
    };

    const loadProjects = useCallback(() => {
        fetch(`${API_BASE_URL}/projects`)
            .then(response => response.json())
            .then(data => {
                setRowData(data);

                // Generate dynamic columns based on all projects' resource_role_summary
                const dynamicColumns = generateDynamicColumnsAndData(data);
                setDynamicColumnDefs(dynamicColumns);
            })
            .catch(error => console.error('Error loading projects:', error));
    }, []);

    const loadStrategicPortfolios = () => {
        fetch(`${API_BASE_URL}/strategic_portfolios`)
            .then(response => response.json())
            .then(data => setStrategicPortfolios(data))
            .catch(error => console.error('Error loading strategic portfolios:', error));
    };

    const loadProductLines = (strategicPortfolio) => {
        fetch(`${API_BASE_URL}/product_lines/${strategicPortfolio}`)
            .then(response => response.json())
            .then(data => setProductLines(data))
            .catch(error => console.error('Error loading product lines:', error));
    };

    useEffect(() => {
        loadProjects(); // Load only the project data on page load
        loadStrategicPortfolios(); // Load strategic portfolios on page load
    }, [loadProjects]);

    useEffect(() => {
        // Set columnDefs directly from dynamicColumnDefs
        setColumnDefs(dynamicColumnDefs);
    }, [dynamicColumnDefs]);

    const addOrUpdateProject = (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const projectData = Object.fromEntries(formData.entries());

        if (selectedProject) {
            projectData.project_id = selectedProject.project_id;
        }

        fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        console.error('Error response from server:', errorData);
                        throw new Error('Network response was not ok');
                    });
                }
                return response.json();
            })
            .then(() => {
                loadProjects(); // Refresh the grid after saving changes
                setErrorMessage('');
                setIsModalOpen(false);
            })
            .catch(error => {
                console.error('Error adding or updating project:', error);
                setErrorMessage('Failed to add or update project. Please try again.');
            });
    };

    const handleAddTimelineRow = () => {
        setTimelines([...timelines, { milestone: '', start_date: '', end_date: '', isNew: true }]);
    };

    const handleTimelineChange = (index, field, value) => {
        const updatedTimelines = [...timelines];
        updatedTimelines[index][field] = value;
        setTimelines(updatedTimelines);
    };

    const handleDeleteTimeline = (index) => {
        const timelineToDelete = timelines[index];
        setDeletedTimelines([...deletedTimelines, timelineToDelete]);
        const updatedTimelines = timelines.map((timeline, i) =>
            i === index ? { ...timeline, isDeleted: true } : timeline
        );
        setTimelines(updatedTimelines);
    };

    const handleUndoDeleteTimeline = (index) => {
        const timelineToRestore = timelines[index];
        setDeletedTimelines(deletedTimelines.filter((t) => t.milestone !== timelineToRestore.milestone));
        const updatedTimelines = timelines.map((timeline, i) =>
            i === index ? { ...timeline, isDeleted: false } : timeline
        );
        setTimelines(updatedTimelines);
    };

    const handleMoveTimeline = (index, direction) => {
        const updatedTimelines = [...timelines];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= updatedTimelines.length) return; // Prevent out-of-bounds movement

        // Swap the timelines
        [updatedTimelines[index], updatedTimelines[targetIndex]] = [updatedTimelines[targetIndex], updatedTimelines[index]];

        // Update the sequence values
        updatedTimelines[index].sequence = targetIndex + 1;
        updatedTimelines[targetIndex].sequence = index + 1;

        setTimelines(updatedTimelines);
    };

    const handleSaveTimelines = async () => {
        if (!selectedProject) {
            alert('No project selected. Please select a project to save timelines.');
            return;
        }

        const projectId = selectedProject.project_id;

        try {
            // Prepare the reordered timelines for saving
            const reorderedTimelines = timelines.map((timeline, index) => ({
                ...timeline,
                sequence: index + 1 // Update the sequence based on the current order
            }));

            // Delete timelines marked as deleted
            const deletePromises = deletedTimelines.map((timeline) =>
                fetch(`${API_BASE_URL}/projects/timelines/${projectId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ milestone: timeline.milestone })
                })
            );

            // Save or update timelines
            const savePromises = reorderedTimelines
                .filter((timeline) => !timeline.isDeleted)
                .map((timeline) =>
                    fetch(`${API_BASE_URL}/projects/timelines/${projectId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(timeline)
                    })
                );

            await Promise.all([...deletePromises, ...savePromises]);

            setDeletedTimelines([]);
            fetchTimelines(projectId); // Refresh the timeline data after saving
            loadProjects(); // Refresh the grid after saving timelines
        } catch (error) {
            console.error('Error saving timelines:', error);

            if (error.message.includes('Failed to fetch')) {
                alert('Server is unavailable. Redirecting to the landing page.');
                navigate('/'); // Redirect to the landing page
            } else {
                alert('An error occurred while saving timelines. Please try again.');
            }
        }
    };

    const formatResourceDetails = (details, datasetLabel) => {
        if (!details || details.length === 0) {
            return 'No resource details available';
        }
        return details.map((detail) => {
            const resourceInfo = `${detail.resource_name} (${detail.resource_email})`;
            const plannedHours = detail.resource_hours_planned || 0;
            const actualHours = detail.resource_hours_actual || 0;
            const plannedCost = detail.resource_cost_planned || 0;
            const actualCost = detail.resource_cost_actual || 0;

            if (datasetLabel === 'Planned Hours') {
                return `${resourceInfo} - Planned: ${plannedHours} Hrs.`;
            } else if (datasetLabel === 'Actual Hours') {
                return `${resourceInfo} - Actual: ${actualHours} Jrs.`;
            } else if (datasetLabel === 'Planned Cost') {
                return `${resourceInfo} - Planned: $${plannedCost.toFixed(2)}`;
            } else if (datasetLabel === 'Actual Cost') {
                return `${resourceInfo} - Actual: $${actualCost.toFixed(2)}`;
            }
            return resourceInfo;
        });
    };

    // Helper to build chart.js data for a resource (trend line)
    const buildResourceLineChartData = (resourceData, interval) => {
        if (!Array.isArray(resourceData) || resourceData.length === 0) {
            return { labels: [], datasets: [] };
        }
        let labels;
        if (interval === 'Weekly') {
            labels = resourceData.map((period, idx) => (idx % 2 === 0 ? period.start_date : ''));
        } else {
            labels = resourceData.map(period => period.start_date);
        }
        const safeNum = v => (typeof v === 'number' && !isNaN(v) ? v : 0);
        return {
            labels,
            datasets: [
                {
                    label: 'Available Capacity',
                    data: resourceData.map(period => safeNum(period.available_capacity)),
                    borderColor: 'rgba(75, 192, 192, 1)', // match main chart color
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                },
                {
                    label: 'Planned Allocation',
                    data: resourceData.map(period => safeNum(period.allocation_hours_planned)),
                    borderColor: 'rgba(153, 102, 255, 1)', // match main chart color
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                },
                {
                    label: 'Actual Allocation',
                    data: resourceData.map(period => safeNum(period.allocation_hours_actual)),
                    borderColor: 'rgba(255, 99, 132, 1)', // match main chart color
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                }
            ]
        };
    };

    // Fetch resource-level line chart data in parallel
    const fetchResourceLineCharts = async (resourceIds, startDate, endDate, interval) => {
        if (!resourceIds || resourceIds.length === 0) {
            setResourceLineChartsData([]);
            return;
        }
        try {
            const promises = resourceIds.map(resource_id =>
                fetch(
                    `${API_BASE_URL}/resource_capacity_allocation?resource_id=${resource_id}&start_date=${startDate}&end_date=${endDate}&interval=${interval}`
                ).then(res => res.json().then(response => ({ 
                    resource_id, 
                    data: response.data || [], // Extract data array from new response structure
                    resource_details: response.resource_details || null // Include resource details
                })))
            );
            const results = await Promise.all(promises);
            setResourceLineChartsData(results); // [{resource_id, data: [...], resource_details: {...}}, ...]
        } catch (err) {
            setResourceLineChartsData([]);
            console.error('Error fetching resource line charts:', err);
        }
    };

    // Update fetchLineChartData to also fetch resource-level charts
    const fetchLineChartData = async (projectId, interval, startDateEst, endDateEst) => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/project_capacity_allocation/${projectId}?interval=${interval}`
            );
            if (!response.ok) {
                throw new Error('Failed to fetch line chart data');
            }
            const data = await response.json();

            // The API response has "intervals" array with start_date and end_date
            const intervals = Array.isArray(data.intervals) ? data.intervals : [];
            // Use start_date as label for both Weekly and Monthly
            const labels = intervals.map(period => period.start_date);
            const capacityData = intervals.map(period => period.total_capacity || 0);
            const allocationData = intervals.map(period => period.allocation_hours_planned || 0);
            const actualAllocationData = intervals.map(period => period.allocation_hours_actual || 0);
            const plannedCosts = intervals.map(period => period.allocation_cost_planned || 0);
            const actualCosts = intervals.map(period => period.allocation_cost_actual || 0);

            // For tooltips, use resource_details from each period
            const resourceDetails = intervals.map(period => period.resource_details || []);

            const chartData = {
                labels,
                datasets: [
                    {
                        label: 'Total Capacity',
                        data: capacityData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        fill: true,
                    },
                    {
                        label: 'Planned Allocation',
                        data: allocationData,
                        borderColor: 'rgba(153, 102, 255, 1)',
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        fill: true,
                    },
                    {
                        label: 'Actual Allocation',
                        data: actualAllocationData,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        fill: true,
                    },
                ],
                resourceDetails, // Array of arrays, one per period
                grandTotals: {
                    grand_total_capacity: data.grand_total_capacity,
                    grand_total_allocation_hours_planned: data.grand_total_allocation_hours_planned,
                    grand_total_allocation_hours_actual: data.grand_total_allocation_hours_actual,
                    grand_total_available_capacity: data.grand_total_available_capacity,
                    project_id: data.project_id,
                }
            };

            const costChartData = {
                labels,
                datasets: [
                    {
                        label: 'Planned Cost',
                        data: plannedCosts,
                        borderColor: 'rgba(255, 206, 86, 1)',
                        backgroundColor: 'rgba(255, 206, 86, 0.2)',
                        fill: true,
                    },
                    {
                        label: 'Actual Cost',
                        data: actualCosts,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        fill: true,
                    },
                ],
                resourceDetails, // Array of arrays, one per period
            };

            // Extract unique resource_ids from the API response
            const allResourceIds = [];
            intervals.forEach(period => {
                if (Array.isArray(period.resource_details)) {
                    period.resource_details.forEach(r => {
                        if (r.resource_id && !allResourceIds.includes(r.resource_id)) {
                            allResourceIds.push(r.resource_id);
                        }
                    });
                }
            });

            // Fetch resource-level charts in parallel
            await fetchResourceLineCharts(allResourceIds, startDateEst, endDateEst, interval);

            setLineChartData(chartData);
            setCostLineChartData(costChartData);
        } catch (error) {
            console.error('Error fetching line chart data:', error.message);
            setLineChartData(null);
            setCostLineChartData(null);
            setResourceLineChartsData([]);
        }
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        scales: {
            x: {
                ticks: {
                    font: {
                        size: 10,
                    },
                },
            },
            y: {
                title: {
                    display: true,
                    text: 'Hours',
                },
            },
        },
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                callbacks: {
                    title: function (tooltipItems) {
                        const label = tooltipItems[0].label;
                        return `Period: ${label}`;
                    },
                    label: function (tooltipItem) {
                        const datasetLabel = tooltipItem.dataset.label;
                        const dataPointValue = tooltipItem.raw;
                        // Use resourceDetails from the API response directly
                        const resourceDetails = lineChartData.resourceDetails[tooltipItem.dataIndex] || [];
                        // Compose resource-level details for the tooltip
                        const relevantDetails = resourceDetails.map(resource => {
                            const resourceInfo = `${resource.resource_name || 'Unknown'} (${resource.resource_email || 'Unknown'})`;
                            if (datasetLabel === 'Total Capacity') {
                                const cap = Number(resource.total_capacity) || 0;
                                return `${resourceInfo} - Capacity: ${cap.toFixed(1)} Hrs.`;
                            } else if (datasetLabel === 'Planned Allocation') {
                                return `${resourceInfo} - Planned: ${resource.allocation_hours_planned || 0} Hrs.`;
                            } else if (datasetLabel === 'Actual Allocation') {
                                return `${resourceInfo} - Actual: ${resource.allocation_hours_actual || 0} Hrs.`;
                            }
                            return null;
                        }).filter(Boolean);

                        return [`${datasetLabel}: ${dataPointValue}`, ...relevantDetails];
                    },
                },
            },
            annotation: {
                annotations: {
                    startDateLine: selectedProject?.start_date_est ? {
                        type: 'line',
                        scaleID: 'x',
                        value: selectedProject.start_date_est,
                        borderColor: 'green',
                        borderWidth: 2,
                        label: {
                            content: 'Start Date Est.',
                            enabled: true,
                            position: 'top'
                        }
                    } : null,
                    endDateLine: selectedProject?.end_date_est ? {
                        type: 'line',
                        scaleID: 'x',
                        value: selectedProject.end_date_est,
                        borderColor: 'red',
                        borderWidth: 2,
                        label: {
                            content: 'End Date Est.',
                            enabled: true,
                            position: 'top'
                        }
                    } : null
                }
            }
        }
    };

    const costLineChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        scales: {
            x: {
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Cost'
                }
            }
        },
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                callbacks: {
                    title: function (tooltipItems) {
                        const label = tooltipItems[0].label;
                        return `${label}`;
                    },
                    label: function (tooltipItem) {
                        const datasetLabel = tooltipItem.dataset.label;
                        const dataPointValue = tooltipItem.raw;
                        // Use resourceDetails from the API response directly
                        const resourceDetails = costLineChartData.resourceDetails[tooltipItem.dataIndex] || [];
                        let mainLabel = '';
                        if (datasetLabel.includes('Hours') || datasetLabel.includes('Capacity') || datasetLabel.includes('Allocation')) {
                            mainLabel = `${datasetLabel}: ${dataPointValue} Hrs.`;
                        } else if (datasetLabel.includes('Cost')) {
                            mainLabel = `${datasetLabel}: $${dataPointValue}`;
                        } else {
                            mainLabel = `${datasetLabel}: ${dataPointValue}`;
                        }
                        if (!resourceDetails || resourceDetails.length === 0) {
                            return mainLabel;
                        }
                        // Compose resource-level details for the tooltip
                        const relevantDetails = resourceDetails.map(resource => {
                            const resourceInfo = `${resource.resource_name || 'Unknown'} (${resource.resource_email || 'Unknown'})`;
                            if (datasetLabel === 'Planned Cost') {
                                return `${resourceInfo} - Planned: $${resource.allocation_cost_planned?.toFixed(2) || 0}`;
                            } else if (datasetLabel === 'Actual Cost') {
                                return `${resourceInfo} - Actual: $${resource.allocation_cost_actual?.toFixed(2) || 0}`;
                            }
                            return null;
                        }).filter(Boolean);

                        return [mainLabel, ...relevantDetails];
                    },
                },
            }
        }
    };

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                callbacks: {
                    title: function (tooltipItems) {
                        const role = tooltipItems[0].label; // Role label (e.g., Full Stack Developer)
                        const dataPointValue = tooltipItems[0].raw; // Data point value (e.g., hours or cost)
                        const datasetLabel = tooltipItems[0].dataset.label; // Dataset label (e.g., Planned Hours, Planned Cost)

                        // Add suffix or prefix based on the dataset label
                        if (datasetLabel.includes('Hours')) {
                            return `${role} (${dataPointValue} Hrs.)`;
                        } else if (datasetLabel.includes('Cost')) {
                            return `${role} ($${dataPointValue})`;
                        }
                        return `${role} (${dataPointValue})`;
                    },
                    label: function (tooltipItem) {
                        const datasetLabel = tooltipItem.dataset.label; // Dataset label (e.g., Planned Hours)
                        const resourceDetails = barChartData.hoursChartData.resourceDetails[tooltipItem.dataIndex];
                        if (!resourceDetails || resourceDetails.length === 0) {
                            return 'No resource details available';
                        }
                        return formatResourceDetails(resourceDetails, datasetLabel); // Display resource details with individual hours/costs
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: true,
                title: {
                    display: true,
                },
                ticks: {
                    maxRotation: 0,
                    autoSkip: false
                }
            },
            y: {
                stacked: true,
                title: {
                    display: true,
                }
            }
        }
    };

    const costsBarChartOptions = {
        ...barChartOptions,
        plugins: {
            ...barChartOptions.plugins,
            tooltip: {
                callbacks: {
                    title: function (tooltipItems) {
                        const role = tooltipItems[0].label; // Role label (e.g., Business Analyst)
                        const dataPointValue = tooltipItems[0].raw; // Data point value (e.g., cost)
                        const datasetLabel = tooltipItems[0].dataset.label; // Dataset label (e.g., Planned Cost)

                        // Add suffix or prefix based on the dataset label
                        if (datasetLabel.includes('Hours')) {
                            return `${role} (${dataPointValue} Hrs.)`;
                        } else if (datasetLabel.includes('Cost')) {
                            return `${role} ($${dataPointValue})`;
                        }
                        return `${role} (${dataPointValue})`;
                    },
                    label: function (tooltipItem) {
                        const datasetLabel = tooltipItem.dataset.label; // Dataset label (e.g., Planned Cost)
                        const resourceDetails = barChartData.costsChartData.resourceDetails[tooltipItem.dataIndex];
                        if (!resourceDetails || resourceDetails.length === 0) {
                            return 'No resource details available';
                        }
                        return formatResourceDetails(resourceDetails, datasetLabel); // Display resource details with individual hours/costs
                    }
                }
            }
        }
    };

    const onIntervalChange = (event) => {
        const selectedInterval = event.target.value;
        setLineChartInterval(selectedInterval);
        if (selectedProject) {
            fetchLineChartData(selectedProject.project_id, selectedInterval, selectedProject.start_date_est, selectedProject.end_date_est);
        }
    };

    const fetchTimelines = async (projectId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/timelines/${projectId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch timelines');
            }
            const data = await response.json();
            setTimelines(data.map(timeline => ({
                ...timeline,
                isDeleted: false // Ensure timelines are not marked as deleted by default
            })));
        } catch (error) {
            console.error('Error fetching timelines:', error);
            setTimelines([]); // Clear timelines on error
        }
    };

    const exportToExcel = () => {
        const allData = [];
        const allColumns = gridApi.getColumnDefs(); // Get all column definitions from the grid

        // Flatten headers for dynamic columns
        const headers = [];
        allColumns.forEach((col) => {
            if (col.children) {
                col.children.forEach((child) => {
                    headers.push(`${col.headerName} - ${child.headerName}`); // Combine parent and child headers
                });
            } else {
                headers.push(col.headerName);
            }
        });

        // Extract all visible data from the grid
        gridApi.forEachNodeAfterFilterAndSort((node) => {
            const rowData = {};
            allColumns.forEach((col) => {
                if (col.children) {
                    col.children.forEach((child) => {
                        const childField = child.field;
                        rowData[`${col.headerName} - ${child.headerName}`] = childField
                            ? child.valueGetter
                                ? child.valueGetter({ data: node.data }) || '' // Use valueGetter if defined
                                : node.data[childField] || '' // Fallback to direct field access
                            : '';
                    });
                } else {
                    const field = col.field;
                    rowData[col.headerName] = field
                        ? col.valueGetter
                            ? col.valueGetter({ data: node.data }) || '' // Use valueGetter if defined
                            : node.data[field] || '' // Fallback to direct field access
                        : '';
                }
            });
            allData.push(rowData);
        });

        // Create Excel worksheet and workbook
        const worksheet = XLSX.utils.json_to_sheet(allData, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
        XLSX.writeFile(workbook, 'Projects.xlsx'); // Save the file
    };

    const handleUploadExcel = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            console.error("No file selected.");
            message.error("Please select a file to upload.");
            return;
        }

        try {
            console.log("File selected:", file.name);

            // Read the uploaded file
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    console.log("FileReader onload triggered.");
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0]; // Extract headers

                    console.log("Extracted headers:", headers);

                    // Fetch the expected headers from the correct static route
                    const response = await fetch('/static/excel_to_db.conf');
                    if (!response.ok) {
                        throw new Error(`Failed to fetch configuration: ${response.statusText}`);
                    }
                    const config = await response.json();
                    const expectedHeaders = config.projects.excel_columns;

                    console.log("Expected headers:", expectedHeaders);

                    // Validate headers
                    const missingHeaders = expectedHeaders.filter((header) => !headers.includes(header));
                    if (missingHeaders.length > 0) {
                        console.error("Missing headers:", missingHeaders);
                        message.error(`The following headers are missing: ${missingHeaders.join(', ')}`);
                        return;
                    }

                    console.log("Headers validation passed.");

                    // Parse the Excel data
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null }); // Parse the sheet into JSON
                    console.log("Parsed Excel data:", jsonData);

                    setParsedExcelData(jsonData);

                    // Generate column definitions for the overlay grid
                    const columnDefs = expectedHeaders.map((header) => ({
                        headerName: header,
                        field: header,
                        sortable: true,
                        filter: true,
                        resizable: true,
                    }));
                    setExcelColumnDefs(columnDefs);

                    // Show the overlay grid
                    setIsOverlayVisible(true);
                    console.log("Overlay grid displayed.");
                } catch (error) {
                    console.error("Error processing the Excel file:", error);
                    message.error("An error occurred while processing the Excel file.");
                }
            };

            reader.onerror = (error) => {
                console.error("FileReader error:", error);
                message.error("An error occurred while reading the file.");
            };

            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error("Error in handleUploadExcel:", error);
            message.error("An unexpected error occurred while uploading the Excel file.");
        }
    };

    const handleSaveData = async () => {
        try {
            // Prepare the data for API submission
            const formData = new FormData();
            formData.append('table_name', 'projects');
            formData.append('data', JSON.stringify(parsedExcelData)); // Send parsed data as JSON

            const response = await fetch('/excel_to_db', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                message.success('Data saved to the database successfully!');
                setIsOverlayVisible(false); // Close the overlay
                loadProjects(); // Refresh the grid
            } else {
                const errorData = await response.json();
                message.error(`Error saving data to the database: ${errorData.detail}`);
            }
        } catch (error) {
            console.error('Error saving data to the database:', error);
            message.error('An error occurred while saving data to the database.');
        }
    };

    const handleCancelOverlay = () => {
        setIsOverlayVisible(false); // Close the overlay without saving
    };

    const onGridReady = params => {
        setGridApi(params.api); // Set gridApi when the grid is ready
    };

    const onSelectionChanged = async () => {
        const selectedRows = gridApi.getSelectedRows();
        if (selectedRows.length > 0) {
            const selectedProject = selectedRows[0];
            setSelectedProject(selectedProject);
            setIsUpdateButtonEnabled(true);

            // Use resource_role_summary from the selected project to generate chart data
            fetchChartData(selectedProject);

            fetchLineChartData(selectedProject.project_id, lineChartInterval, selectedProject.start_date_est, selectedProject.end_date_est);
            fetchTimelines(selectedProject.project_id);

            const dynamicColumns = generateDynamicColumnsAndData([selectedProject]);
            setDynamicColumnDefs(dynamicColumns);
        } else {
            setSelectedProject(null);
            setIsUpdateButtonEnabled(false);
            setBarChartData(null);
            setLineChartData(null);
            setCostLineChartData(null);
            setTimelines([]);
            setDynamicColumnDefs([]);
        }
    };

    // Add this function before onSelectionChanged
    const fetchChartData = async (project) => {
        try {
            if (!project || !project.project_id) {
                console.error('Invalid project data or missing project_id.');
                setBarChartData(null);
                return;
            }

            const roleSummary = project.resource_role_summary || {};

            if (Object.keys(roleSummary).length === 0) {
                console.warn(`No resource role summary found for project_id: ${project.project_id}`);
                setBarChartData(null);
                return;
            }

            const labels = Object.keys(roleSummary);
            const plannedHours = labels.map(role => roleSummary[role]?.total_resource_hours_planned || 0);
            const actualHours = labels.map(role => roleSummary[role]?.total_resource_hours_actual || 0);
            const plannedCosts = labels.map(role => roleSummary[role]?.total_resource_cost_planned || 0);
            const actualCosts = labels.map(role => roleSummary[role]?.total_resource_cost_actual || 0);

            const resourcesDetails = labels.map(role => {
                const details = roleSummary[role]?.resources_details || [];
                return details.map(detail => ({
                    resource_name: detail.resource_name || 'Unknown',
                    resource_email: detail.resource_email || 'Unknown',
                    resource_hours_planned: detail.resource_hours_planned || 0,
                    resource_hours_actual: detail.resource_hours_actual || 0,
                    resource_cost_planned: detail.resource_cost_planned || 0,
                    resource_cost_actual: detail.resource_cost_actual || 0
                }));
            });

            const hoursChartData = {
                labels,
                datasets: [
                    {
                        label: 'Planned Hours',
                        data: plannedHours,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Actual Hours',
                        data: actualHours,
                        backgroundColor: 'rgba(153, 102, 255, 0.6)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1
                    }
                ],
                resourceDetails: resourcesDetails
            };

            const costsChartData = {
                labels,
                datasets: [
                    {
                        label: 'Planned Cost',
                        data: plannedCosts,
                        backgroundColor: 'rgba(255, 206, 86, 0.6)',
                        borderColor: 'rgba(255, 206, 86, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Actual Cost',
                        data: actualCosts,
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ],
                resourceDetails: resourcesDetails
            };

            setBarChartData({ hoursChartData, costsChartData });
        } catch (error) {
            console.error('Error processing chart data:', error);
            setBarChartData(null);
        }
    };

    useEffect(() => {
        if (activeTab === 'Timelines' && selectedProject) {
            fetchTimelines(selectedProject.project_id); // Fetch timelines when switching to the "Timelines" tab
        }
    }, [activeTab, selectedProject]);

    const onAddNewProject = () => {
        setSelectedProject(null); // Clear the selected project to ensure the form is empty
        setIsModalOpen(true); // Open the modal
    };

    return (
        <div>
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <Tooltip title="Export Grid Data">
                    <FaFileExcel 
                        onClick={exportToExcel} 
                        style={{ fontSize: '40px', cursor: 'pointer', color: 'green' }} 
                    />
                </Tooltip>
                <Tooltip title="Upload Excel">
                    <label style={{ cursor: 'pointer' }}>
                        <FaPaperclip style={{ fontSize: '35px', color: 'blue' }} />
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            style={{ display: 'none' }}
                            onChange={handleUploadExcel}
                        />
                    </label>
                </Tooltip>
            </div>
            <div id="projects-grid" className="ag-theme-alpine" style={{ width: '100%', height: '500px', position: 'relative' }}>
                <AgGridReact
                    columnDefs={columnDefs} // Use updated columnDefs from state
                    rowData={rowData}
                    defaultColDef={defaultColDef} // Apply default column definitions
                    frameworkComponents={{ resourceTooltip: ResourceTooltip }} // Register the custom tooltip component
                    tooltipShowDelay={0} // Show tooltip immediately
                    rowSelection="single"
                    domLayout="normal"
                    onGridReady={onGridReady}
                    onSelectionChanged={onSelectionChanged}
                />
            </div>
            <Modal
                title="Confirm Data Upload"
                visible={isOverlayVisible}
                onCancel={handleCancelOverlay}
                footer={[
                    <Button key="cancel" onClick={handleCancelOverlay}>
                        Cancel
                    </Button>,
                    <Button key="save" type="primary" onClick={handleSaveData}>
                        Save Data
                    </Button>,
                ]}
                width={1000}
            >
                <div className="ag-theme-alpine" style={{ height: '400px', width: '100%' }}>
                    <AgGridReact
                        columnDefs={excelColumnDefs}
                        rowData={parsedExcelData}
                        defaultColDef={{
                            sortable: true,
                            filter: true,
                            resizable: true,
                        }}
                    />
                </div>
            </Modal>
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '15px', marginTop: '20px'  }}>
                <button className="btn btn-success" onClick={onAddNewProject}>Add New Project</button>
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(true)} disabled={!isUpdateButtonEnabled}>
                    Update Project
                </button>
                <Tooltip title="New Project Template">
                    <a href="/ExcelTemplates/Project_Template.xlsx" download>
                        <FaPaperclip style={{ fontSize: '35px', cursor: 'pointer', color: 'green', marginTop: '5px' }} />
                    </a>
                </Tooltip>
            </div>
            <div style={{ marginTop: '20px' }}>
                <ul className="nav nav-tabs" style={{ display: 'inline-flex' }}>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'Charts' ? 'active' : ''}`}
                            onClick={() => setActiveTab('Charts')}
                            style={{ cursor: 'pointer', background: 'none', border: 'none' }}
                        >
                            Charts
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'Timelines' ? 'active' : ''}`}
                            onClick={() => setActiveTab('Timelines')}
                            style={{ cursor: 'pointer', background: 'none', border: 'none' }}
                        >
                            Timelines
                        </button>
                    </li>
                </ul>
            </div>
            <div className="tab-content mt-3" style={{ width: '100vw' }}>
                {activeTab === 'Charts' && (
                    <div className="outer-wrapper">
                        <div
                            style={{
                                border: '1px solid #ddd',
                                borderRadius: '18px',
                                backgroundColor: 'white',
                                width: '100%',
                                display: 'center',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '10px' }}>
                                {selectedProject &&
                                    `${selectedProject.project_name} (${selectedProject.strategic_portfolio} - ${selectedProject.product_line})`
                                }
                            </div>
                            <ul className="nav nav-tabs" style={{ display: 'inline-flex', marginBottom: '10px', borderBottom: '1px solid #ddd' }}>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeSubTab === 'Hours' ? 'active' : ''}`}
                                        onClick={() => setActiveSubTab('Hours')}
                                        style={{
                                            cursor: 'pointer',
                                            background: activeSubTab === 'Hours' ? '#e9ecef' : 'none',
                                            border: activeSubTab === 'Hours' ? '1px solid #ddd' : 'none',
                                            borderBottom: activeSubTab === 'Hours' ? 'none' : '1px solid #ddd',
                                            borderRadius: '8px 8px 0 0',
                                            padding: '10px 15px'
                                        }}
                                    >
                                        Hours
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeSubTab === 'Cost' ? 'active' : ''}`}
                                        onClick={() => setActiveSubTab('Cost')}
                                        style={{
                                            cursor: 'pointer',
                                            background: activeSubTab === 'Cost' ? '#e9ecef' : 'none',
                                            border: activeSubTab === 'Cost' ? '1px solid #ddd' : 'none',
                                            borderBottom: activeSubTab === 'Cost' ? 'none' : '1px solid #ddd',
                                            borderRadius: '8px 8px 0 0',
                                            padding: '10px 15px'
                                        }}
                                    >
                                        Cost
                                    </button>
                                </li>
                            </ul>

                            {activeSubTab === 'Hours' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
                                    {selectedProject && barChartData && barChartData.hoursChartData && (
                                        <div style={{ width: '100%', textAlign: 'center', paddingTop: '5px', height: '300px', margin: '0 auto', marginBottom: '40px' }}>
                                            <h6 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Planned vs. Actual Hours by Role</h6>
                                            <Bar
                                                data={barChartData.hoursChartData}
                                                options={{ ...barChartOptions, maintainAspectRatio: false }}
                                                width={1200} // Consistent width
                                                height={400} // Consistent height
                                            />
                                        </div>
                                    )}
                                    {selectedProject && lineChartData && (
                                        <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '600px', width: '100%', margin: '0 auto', padding: '0 10px' }}>
                                            <h6 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Capacity, Planned, and Actual Allocation Hours</h6>
                                            <div style={{ marginBottom: '20px', width: '100%', textAlign: 'center' }}>
                                                <label>
                                                    <input
                                                        type="radio"
                                                        name="interval"
                                                        value="Weekly"
                                                        checked={lineChartInterval === 'Weekly'}
                                                        onChange={onIntervalChange}
                                                    /> Weekly
                                                </label>
                                                <label style={{ marginLeft: '20px' }}>
                                                    <input
                                                        type="radio"
                                                        name="interval"
                                                        value="Monthly"
                                                        checked={lineChartInterval === 'Monthly'}
                                                        onChange={onIntervalChange}
                                                    /> Monthly
                                                </label>
                                            </div>
                                            <Line
                                                data={lineChartData}
                                                options={{ ...lineChartOptions, maintainAspectRatio: false }}
                                                width={1200}
                                                height={400}
                                            />
                                        </div>
                                    )}
                                    {/* Resource-level trend line charts - moved lower and styled */}
                                    {resourceLineChartsData && resourceLineChartsData.length > 0 && (
                                        <div style={{ width: '100%', marginTop: '120px', paddingBottom: '20px' }}>
                                            {/* Legend for resource-level charts */}
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: '30px',
                                                marginBottom: '10px',
                                                fontSize: '13px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: '18px', height: '3px', background: 'rgba(75, 192, 192, 1)', display: 'inline-block', borderRadius: '2px' }}></span>
                                                    <span>Available Capacity</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: '18px', height: '3px', background: 'rgba(153, 102, 255, 1)', display: 'inline-block', borderRadius: '2px' }}></span>
                                                    <span>Planned Allocation</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: '18px', height: '3px', background: 'rgba(255, 99, 132, 1)', display: 'inline-block', borderRadius: '2px' }}></span>
                                                    <span>Actual Allocation</span>
                                                </div>
                                            </div>
                                            <h6 style={{
                                                fontWeight: 'bold',
                                                marginBottom: '18px',
                                                textAlign: 'center',
                                                fontSize: '15px',
                                                color: '#444'
                                            }}>
                                                Resource Trends (Available Capacity, Planned, Actual)
                                            </h6>
                                            <div style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '28px',
                                                justifyContent: 'center'
                                            }}>
                                                {resourceLineChartsData.map(({ resource_id, data, resource_details }) => {
                                                    if (!data || data.length === 0) return null;
                                                    // Get resource name and email from resource_details if available
                                                    let resourceName = '';
                                                    let resourceEmail = '';
                                                    
                                                    if (resource_details) {
                                                        resourceName = resource_details.resource_name || '';
                                                        resourceEmail = resource_details.resource_email || '';
                                                    } else {
                                                        // Fallback to checking first data element (legacy behavior)
                                                        const first = data[0] || {};
                                                        if (typeof first.resource_name === 'string' && first.resource_name) {
                                                            resourceName = first.resource_name;
                                                        }
                                                        if (typeof first.resource_email === 'string' && first.resource_email) {
                                                            resourceEmail = first.resource_email;
                                                        }
                                                    }
                                                    // Fallback: try to find from lineChartData.resourceDetails
                                                    if ((!resourceName || !resourceEmail) && Array.isArray(lineChartData?.resourceDetails)) {
                                                        for (const periodResources of lineChartData.resourceDetails) {
                                                            if (Array.isArray(periodResources)) {
                                                                const found = periodResources.find(r => r.resource_id === resource_id);
                                                                if (found) {
                                                                    if (!resourceName && found.resource_name) resourceName = found.resource_name;
                                                                    if (!resourceEmail && found.resource_email) resourceEmail = found.resource_email;
                                                                    if (resourceName && resourceEmail) break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                    return (
                                                        <div key={resource_id} style={{
                                                            width: '320px',
                                                            height: '160px',
                                                            border: '1px solid #eee',
                                                            borderRadius: '8px',
                                                            background: '#fafbfc',
                                                            padding: '8px',
                                                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                                            marginBottom: '10px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            justifyContent: 'space-between'
                                                        }}>
                                                            <div style={{
                                                                fontSize: '12px',
                                                                fontWeight: 'bold',
                                                                marginBottom: '2px',
                                                                textAlign: 'center',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}>
                                                                {resourceName} <span style={{ color: '#888', fontWeight: 'normal' }}>({resourceEmail})</span>
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <Line
                                                                    data={buildResourceLineChartData(data, lineChartInterval)}
                                                                    options={{
                                                                        responsive: true,
                                                                        maintainAspectRatio: false,
                                                                        plugins: {
                                                                            legend: { display: false },
                                                                            tooltip: {
                                                                                callbacks: {
                                                                                    title: function (items) {
                                                                                        const idx = items[0].dataIndex;
                                                                                        if (lineChartInterval === 'Weekly') {
                                                                                            const period = data[idx];
                                                                                            return period ? `Week Start: ${period.week_start}` : '';
                                                                                        } else {
                                                                                            const period = data[idx];
                                                                                            return period ? `Month: ${period.month}` : '';
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        },
                                                                        scales: {
                                                                            x: { ticks: { font: { size: 8 } } },
                                                                            y: { ticks: { font: { size: 8 } } }
                                                                        }
                                                                    }}
                                                                    width={300}
                                                                    height={110}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeSubTab === 'Cost' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
                                    {selectedProject && barChartData && barChartData.costsChartData && (
                                        <div style={{ width: '100%', textAlign: 'center', paddingTop: '5px', height: '300px', margin: '0 auto', marginBottom: '40px' }}>
                                            <h6 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Planned vs. Actual Costs by Role</h6>
                                            <Bar
                                                data={barChartData.costsChartData}
                                                options={{ ...costsBarChartOptions, maintainAspectRatio: false }}
                                                width={1200} // Consistent width
                                                height={400} // Consistent height
                                            />
                                        </div>
                                    )}
                                    {selectedProject && costLineChartData && (
                                        <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '600px', width: '100%', margin: '0 auto', padding: '0 10px' }}>
                                            <h6 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Planned and Actual Allocation Cost</h6>
                                            <div style={{ marginBottom: '20px', width: '100%', textAlign: 'center' }}>
                                                <label>
                                                    <input
                                                        type="radio"
                                                        name="interval"
                                                        value="Weekly"
                                                        checked={lineChartInterval === 'Weekly'}
                                                        onChange={onIntervalChange}
                                                    /> Weekly
                                                </label>
                                                <label style={{ marginLeft: '20px' }}>
                                                    <input
                                                        type="radio"
                                                        name="interval"
                                                        value="Monthly"
                                                        checked={lineChartInterval === 'Monthly'}
                                                        onChange={onIntervalChange}
                                                    /> Monthly
                                                </label>
                                            </div>
                                            <Line
                                                data={costLineChartData}
                                                options={{ ...costLineChartOptions, maintainAspectRatio: false }}
                                                width={1200} // Consistent width
                                                height={400} // Consistent height
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'Timelines' && (
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <div className="timeline-form mt-3" style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '15px', backgroundColor: '#f9f9f9' }}>
                                <div className="form-row align-items-center" style={{ marginBottom: '5px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
                                    <div className="col-md-4">
                                        <label className="form-label" style={{ fontWeight: 'bold' }}>Milestone</label>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: 'bold' }}>Start Date</label>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label" style={{ fontWeight: 'bold' }}>End Date</label>
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label" style={{ fontWeight: 'bold' }}>Actions</label>
                                    </div>
                                </div>
                                {timelines.map((timeline, index) => (
                                    <div key={index} className="form-row align-items-center" style={{ marginBottom: '5px' }}>
                                        <div className="col-md-4">
                                            {timeline.isNew ? (
                                                <select
                                                    className="form-control"
                                                    value={timeline.milestone}
                                                    onChange={(e) => handleTimelineChange(index, 'milestone', e.target.value)}
                                                    disabled={timeline.isDeleted}
                                                >
                                                    <option value="">Select Milestone</option>
                                                    {milestoneOptions.map((option) => (
                                                        <option key={option} value={option}>{option}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={timeline.milestone}
                                                    readOnly
                                                />
                                            )}
                                        </div>
                                        <div className="col-md-3">
                                            <input
                                                type="date"
                                                className="form-control"
                                                value={timeline.start_date}
                                                onChange={(e) => handleTimelineChange(index, 'start_date', e.target.value)}
                                                disabled={timeline.isDeleted}
                                            />
                                        </div>
                                        <div className="col-md-3">
                                            <input
                                                type="date"
                                                className="form-control"
                                                value={timeline.end_date}
                                                onChange={(e) => handleTimelineChange(index, 'end_date', e.target.value)}
                                                disabled={timeline.isDeleted}
                                            />
                                        </div>
                                        <div className="col-md-2">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-link btn-sm"
                                                    style={{ padding: '0', border: 'none', color: 'blue', fontSize: '18px' }}
                                                    onClick={() => handleMoveTimeline(index, 'up')}
                                                    disabled={index === 0} // Disable "up" button for the first item
                                                >
                                                    <i className="fas fa-arrow-up"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-link btn-sm"
                                                    style={{ padding: '0', border: 'none', color: 'blue', fontSize: '18px' }}
                                                    onClick={() => handleMoveTimeline(index, 'down')}
                                                    disabled={index === timelines.length - 1} // Disable "down" button for the last item
                                                >
                                                    <i className="fas fa-arrow-down"></i>
                                                </button>
                                                {!timeline.isDeleted ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-link btn-sm"
                                                        style={{ padding: '0', border: 'none', color: 'red', fontSize: '18px' }}
                                                        onClick={() => handleDeleteTimeline(index)}
                                                    >
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn btn-link btn-sm"
                                                        style={{ padding: '0', border: 'none', color: 'green', fontSize: '18px' }}
                                                        onClick={() => handleUndoDeleteTimeline(index)}
                                                    >
                                                        <i className="fas fa-undo"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    className="btn btn-link"
                                    style={{ fontSize: '24px', color: 'green', padding: '0', border: 'none' }}
                                    onClick={handleAddTimelineRow}
                                >
                                    <i className="fas fa-plus-circle"></i>
                                </button>
                                <button className="btn btn-success mt-2 ml-2" onClick={handleSaveTimelines}>Save Timelines</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {isModalOpen && (
                <ProjectsModal
                    strategicPortfolios={strategicPortfolios}
                    productLines={productLines}
                    loadProductLines={loadProductLines}
                    addProject={addOrUpdateProject}
                    errorMessage={errorMessage}
                    selectedProject={selectedProject}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Projects;