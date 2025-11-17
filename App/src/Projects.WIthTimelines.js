import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ModuleRegistry } from '@ag-grid-community/core';
import { API_BASE_URL } from '../config';
import { FaFileExcel } from 'react-icons/fa';
import { exportToExcel } from '../utils/exportToExcel';
import ProjectsModal from './ProjectsModal';
import { Pie, Line } from 'react-chartjs-2';
import 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'chart.js';
import { Chart as GanttChart } from 'react-google-charts';

ModuleRegistry.registerModules([ClientSideRowModelModule]);
Chart.register(annotationPlugin);

const Projects = () => {
    const [rowData, setRowData] = useState([]);
    const [strategicPortfolios, setStrategicPortfolios] = useState([]);
    const [productLines, setProductLines] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [isUpdateButtonEnabled, setIsUpdateButtonEnabled] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [pieChartData, setPieChartData] = useState(null);
    const [lineChartData, setLineChartData] = useState(null);
    const [resourceNamesByRole, setResourceNamesByRole] = useState({});
    const [interval, setInterval] = useState('Weekly');
    const chartContainerRef = useRef(null);
    const [activeTab, setActiveTab] = useState('Charts');
    const [columnDefs, setColumnDefs] = useState([
        { headerName: 'Project ID', field: 'project_id' },
        { headerName: 'Project Name', field: 'project_name' },
        { headerName: 'Strategic Portfolio', field: 'strategic_portfolio' },
        { headerName: 'Product Line', field: 'product_line' },
        { headerName: 'Project Type', field: 'project_type' },
        { headerName: 'Project Description', field: 'project_description' },
        { headerName: 'Vitality', field: 'vitality' },
        { headerName: 'Strategic', field: 'strategic' },
        { headerName: 'Aim', field: 'aim' },
        {
            headerName: 'Est. Revenue',
            children: [
                { headerName: 'Growth PA', field: 'revenue_est_growth_pa' },
                { headerName: 'Current Year', field: 'revenue_est_current_year' },
                { headerName: 'Current Year +1', field: 'revenue_est_current_year_plus_1' },
                { headerName: 'Current Year +2', field: 'revenue_est_current_year_plus_2' },
                { headerName: 'Current Year +3', field: 'revenue_est_current_year_plus_3' }
            ]
        },
        { headerName: 'Start Date Est.', field: 'start_date_est' },
        { headerName: 'End Date Est.', field: 'end_date_est' },
        { headerName: 'Start Date Actual', field: 'start_date_actual' },
        { headerName: 'End Date Actual', field: 'end_date_actual' },
        { headerName: 'Current Status', field: 'current_status' },
        { headerName: 'RAG Status', field: 'rag_status' },
        { headerName: 'Comments', field: 'comments' },
        { headerName: 'Added By', field: 'added_by' },
        { headerName: 'Added Date', field: 'added_date' },
        { headerName: 'Updated By', field: 'updated_by' },
        { headerName: 'Updated Date', field: 'updated_date' },
        { headerName: 'Est. No. Of Hours', field: 'total_number_of_hours', valueFormatter: params => params.value || 'N/A' },
        { headerName: 'Est. Project Cost', field: 'total_resource_cost', valueFormatter: params => params.value || 'N/A' }
    ]);
    const [timelines, setTimelines] = useState([{ milestone: '', start_date: '', end_date: '' }]);
    const [deletedTimelines, setDeletedTimelines] = useState([]);
    const [showGanttModal, setShowGanttModal] = useState(false);
    const [ganttView, setGanttView] = useState('Week');
    const [gridApi, setGridApi] = useState(null); // Add state for gridApi

    const loadProjects = useCallback(() => {
        fetch(`${API_BASE_URL}/projects`)
            .then(response => response.json())
            .then(data => setRowData(data))
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
        loadProjects();
        loadStrategicPortfolios();
    }, [loadProjects]);

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
                loadProjects();
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

    const handleSaveTimelines = async () => {
        if (!selectedProject) {
            alert('No project selected. Please select a project to save timelines.');
            return;
        }

        const projectId = selectedProject.project_id;

        try {
            const deletePromises = deletedTimelines.map((timeline) =>
                fetch(`${API_BASE_URL}/projects/${projectId}/timelines`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ milestone: timeline.milestone })
                })
            );

            const savePromises = timelines
                .filter((timeline) => !timeline.isDeleted)
                .map((timeline) =>
                    fetch(`${API_BASE_URL}/projects/${projectId}/timelines`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(timeline)
                    })
                );

            await Promise.all([...deletePromises, ...savePromises]);

            alert('Timelines saved successfully!');
            setDeletedTimelines([]);
        } catch (error) {
            console.error('Error saving timelines:', error);
            alert('An error occurred while saving timelines. Please try again.');
        }
    };

    const fetchChartData = async (projectId) => {
        try {
            const roleSummaryResponse = await fetch(`${API_BASE_URL}/allocations/resource_role_summary/${projectId}`);
            const roleSummary = await roleSummaryResponse.json();

            const projectAllocationsResponse = await fetch(`${API_BASE_URL}/allocations/project/${projectId}`);
            const projectAllocations = await projectAllocationsResponse.json();

            const resourceNamesByRole = projectAllocations.reduce((acc, allocation) => {
                if (!acc[allocation.resource_role]) {
                    acc[allocation.resource_role] = [];
                }
                acc[allocation.resource_role].push(allocation.resource_name);
                return acc;
            }, {});

            setResourceNamesByRole(resourceNamesByRole);

            const chartData = {
                labels: Object.keys(roleSummary),
                datasets: [
                    {
                        label: 'Hours by Role',
                        data: Object.values(roleSummary).map(role => role.total_number_of_hours),
                        backgroundColor: [
                            '#FF6384',
                            '#36A2EB',
                            '#FFCE56',
                            '#4BC0C0',
                            '#9966FF',
                            '#FF9F40'
                        ]
                    }
                ]
            };

            setPieChartData(chartData);

        } catch (error) {
            console.error('Error fetching chart data:', error);
        }
    };

    const fetchLineChartData = async (projectId, interval, startDateEst, endDateEst) => {
        try {
            const response = await fetch(`${API_BASE_URL}/project_capacity_allocation/${projectId}?interval=${interval}`);
            const data = await response.json();

            const labels = data.map(item => interval === 'Weekly' ? item.week_start : item.month);
            const capacityData = data.map(item => item.adjusted_capacity);
            const allocationData = data.map(item => item.planned_allocation);

            const chartData = {
                labels,
                datasets: [
                    {
                        label: 'Adjusted Capacity',
                        data: capacityData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        fill: true
                    },
                    {
                        label: 'Planned Allocation',
                        data: allocationData,
                        borderColor: 'rgba(153, 102, 255, 1)',
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        fill: true
                    }
                ],
                plugins: {
                    annotation: {
                        annotations: {
                            startDateLine: {
                                type: 'line',
                                scaleID: 'x',
                                value: new Date(startDateEst).toISOString().split('T')[0],
                                borderColor: 'green',
                                borderWidth: 2,
                                label: {
                                    content: 'Start Date Est.',
                                    enabled: true,
                                    position: 'top'
                                }
                            },
                            endDateLine: {
                                type: 'line',
                                scaleID: 'x',
                                value: new Date(endDateEst).toISOString().split('T')[0],
                                borderColor: 'red',
                                borderWidth: 2,
                                label: {
                                    content: 'End Date Est.',
                                    enabled: true,
                                    position: 'top'
                                }
                            }
                        }
                    }
                }
            };

            setLineChartData(chartData);
        } catch (error) {
            console.error('Error fetching line chart data:', error);
            setLineChartData(null);
        }
    };

    const onGridReady = params => {
        setGridApi(params.api); // Set gridApi when the grid is ready
    };

    const onSelectionChanged = () => {
        const selectedRows = gridApi.getSelectedRows();
        if (selectedRows.length > 0) {
            setSelectedProject(selectedRows[0]);
            setIsUpdateButtonEnabled(true);
            fetchChartData(selectedRows[0].project_id);
            fetchLineChartData(selectedRows[0].project_id, interval, selectedRows[0].start_date_est, selectedRows[0].end_date_est);
        } else {
            setSelectedProject(null);
            setIsUpdateButtonEnabled(false);
            setPieChartData(null);
            setLineChartData(null);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '10px' }}>
                <FaFileExcel onClick={() => exportToExcel(gridApi)} style={{ fontSize: '25px', cursor: 'pointer', color: 'green' }} />
            </div>
            <div id="projects-grid" className="ag-theme-alpine" style={{ width: '100%', height: '350px', position: 'relative' }}>
                <AgGridReact
                    columnDefs={columnDefs}
                    rowData={rowData}
                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                    rowSelection="single"
                    domLayout="normal"
                    onGridReady={onGridReady} // Ensure onGridReady is passed to the grid
                    onSelectionChanged={onSelectionChanged}
                />
            </div>
            <button className="btn btn-primary mt-3" onClick={() => setIsModalOpen(true)}>Add New Project</button>
            <button className="btn btn-secondary mt-3 ml-2" onClick={() => setIsModalOpen(true)} disabled={!isUpdateButtonEnabled}>Update Project</button>
            <div style={{ marginTop: '20px' }}>
                <ul className="nav nav-tabs" style={{ display: 'inline-flex' }}>
                    <li className="nav-item">
                        <a
                            className={`nav-link ${activeTab === 'Charts' ? 'active' : ''}`}
                            onClick={() => setActiveTab('Charts')}
                            style={{ cursor: 'pointer' }}
                        >
                            Charts
                        </a>
                    </li>
                    <li className="nav-item">
                        <a
                            className={`nav-link ${activeTab === 'Timelines' ? 'active' : ''}`}
                            onClick={() => setActiveTab('Timelines')}
                            style={{ cursor: 'pointer' }}
                        >
                            Timelines
                        </a>
                    </li>
                </ul>
            </div>
            <div className="tab-content mt-3">
                {activeTab === 'Charts' && (
                    <div style={{ display: 'flex', marginTop: '20px' }}>
                        {selectedProject && pieChartData && (
                            <div style={{ width: '25%', marginRight: '20px', textAlign: 'center', paddingTop: '5px' }}>
                                <h6 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Hours by Role</h6>
                                <Pie
                                    data={pieChartData}
                                    options={{
                                        plugins: {
                                            tooltip: {
                                                callbacks: {
                                                    label: function (tooltipItem) {
                                                        const role = tooltipItem.label;
                                                        const resourceNames = resourceNamesByRole[role] || [];
                                                        return `${role}: ${tooltipItem.raw} hours\nResources: ${resourceNames.join(', ')}`;
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        )}
                        {selectedProject && lineChartData && (
                            <div className="chart-container" style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', height: '300px' }} ref={chartContainerRef}>
                                <h6 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Capacity and Planned Allocation</h6>
                                <Line
                                    data={lineChartData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        scales: {
                                            x: {
                                                ticks: {
                                                    font: {
                                                        size: 10
                                                    }
                                                }
                                            }
                                        },
                                        plugins: {
                                            legend: {
                                                position: 'top',
                                            },
                                            tooltip: {
                                                callbacks: {
                                                    label: function (tooltipItem) {
                                                        return `${tooltipItem.dataset.label}: ${tooltipItem.raw}`;
                                                    }
                                                }
                                            },
                                            annotation: {
                                                annotations: {
                                                    startDateLine: {
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
                                                    },
                                                    endDateLine: {
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
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                        )}
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
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={timeline.milestone}
                                                onChange={(e) => handleTimelineChange(index, 'milestone', e.target.value)}
                                                disabled={timeline.isDeleted}
                                            />
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
                                            {!timeline.isDeleted ? (
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTimeline(index)}>Delete</button>
                                            ) : (
                                                <button className="btn btn-success btn-sm" onClick={() => handleUndoDeleteTimeline(index)}>Undo</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <button className="btn btn-primary mt-2" onClick={handleAddTimelineRow}>Add Row</button>
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