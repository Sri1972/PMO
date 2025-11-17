import React, { useEffect, useState, useRef } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { ModuleRegistry } from '@ag-grid-community/core';
import { API_BASE_URL } from '../config';
import ResourcesModal from './ResourcesModal';
import ViewTimeOffModal from './ViewTimeOffModal';
import AddTimeOffModal from './AddTimeOffModal';
import { FaFileExcel, FaPaperclip } from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import ExcelJS from 'exceljs'; // Import ExcelJS for advanced Excel export
import { saveAs } from 'file-saver'; // Import file-saver to save the file locally
import { Tooltip } from 'antd'; // Import Tooltip

// Register the required AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

const CELL_WIDTH = 50; // Define a variable for cell width

const Resources = () => {
    const [rowData, setRowData] = useState([]);
    const [showViewTimeOffModal, setShowViewTimeOffModal] = useState(false);
    const [showAddTimeOffModal, setShowAddTimeOffModal] = useState(false);
    const [showResourcesModal, setShowResourcesModal] = useState(false);
    const [selectedResource, setSelectedResource] = useState(null);
    const [resourcesData, setResourcesData] = useState([]);
    const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
    const [interval, setIntervalValue] = useState('Weekly');
    const [allocationRowData, setAllocationRowData] = useState([]);
    const [chartData, setChartData] = useState({ labels: [], datasets: [] });
    const chartRef = useRef(null);
    const chartContainerRef = useRef(null);

    const [, setCapacityFilter] = useState('');
    const [portfolioLineChartData, setPortfolioLineChartData] = useState(null);

    const loadResourceCapacityAllocation = (startDate, endDate, interval) => {
        if (!startDate || !endDate) {
            alert('Please select both start and end dates.');
            return;
        }

        fetch(`${API_BASE_URL}/resources`)
            .then(response => response.json())
            .then(resources => {
                const promises = resources.map(resource => {
                    if (!resource.resource_id) {
                        console.error('Resource ID is undefined for resource:', resource);
                        return Promise.resolve({ resource, capacity: [] }); // Skip invalid resources
                    }

                    return fetch(`${API_BASE_URL}/resource_capacity_allocation?resource_id=${resource.resource_id}&start_date=${startDate}&end_date=${endDate}&interval=${interval}`)
                        .then(response => response.json())
                        .then(apiResponse => {
                            // Handle new API response structure
                            const capacityData = apiResponse.data || []; // Extract data array
                            const resourceDetails = apiResponse.resource_details || resource; // Use resource_details if available, fallback to resource
                            
                            // Merge resource details with capacity data for compatibility
                            const mergedResource = {
                                ...resource,
                                ...resourceDetails // Override with resource_details if available
                            };
                            
                            return { resource: mergedResource, capacity: Array.isArray(capacityData) ? capacityData : [] };
                        });
                });

                Promise.all(promises)
                    .then(results => {
                        const columnDefs = [
                            { headerName: 'Resource ID', field: 'resource_id' },
                            { headerName: 'Colleague Name', field: 'resource_name' },
                            { headerName: 'Colleague Email', field: 'resource_email' },
                            { headerName: 'Colleague Type', field: 'resource_type' },
                            { headerName: 'Strategic Portfolio', field: 'strategic_portfolio' },
                            { headerName: 'Product Line', field: 'product_line' },
                            { headerName: 'Manager Name', field: 'manager_name' },
                            { headerName: 'Manager Email', field: 'manager_email' },
                            { headerName: 'Colleague Role', field: 'resource_role' },
                            { headerName: 'Timesheet Colleague Name', field: 'timesheet_resource_name' },
                            { headerName: 'Responsibility', field: 'responsibility' },
                            { headerName: 'Skillset', field: 'skillset' },
                            { headerName: 'Comments', field: 'comments' },
                            { headerName: 'Yearly Capacity', field: 'yearly_capacity' }
                        ];

                        if (results.length > 0 && Array.isArray(results[0].capacity)) {
                            results[0].capacity.forEach(period => {
                                const periodLabel = `${period.start_date || ''} to ${period.end_date || ''}`;
                                const periodField = `${period.start_date || ''}_to_${period.end_date || ''}`;
                                columnDefs.push({
                                    headerName: periodLabel,
                                    children: [
                                        {
                                            headerName: 'TC',
                                            field: `${periodField}_tc`,
                                            valueGetter: params => {
                                                const capacity = params.data.capacity ? params.data.capacity.find(c => c.start_date === period.start_date && c.end_date === period.end_date) : null;
                                                return capacity ? capacity.total_capacity : '';
                                            },
                                            cellStyle: params => {
                                                const capacity = params.data.capacity ? params.data.capacity.find(c => c.start_date === period.start_date && c.end_date === period.end_date) : null;
                                                if (capacity) {
                                                    const { available_capacity: AC } = capacity;
                                                    if (AC < 0) return { backgroundColor: 'lightcoral', fontWeight: 'bold', borderLeft: '2px solid black' }; // Red
                                                    if (AC === 0) return { backgroundColor: 'lightblue', fontWeight: 'bold', borderLeft: '2px solid black' }; // Blue
                                                    if (AC > 0) return { backgroundColor: 'lightgreen', fontWeight: 'bold', borderLeft: '2px solid black' }; // Green
                                                }
                                                return { borderLeft: '2px solid black' }; // Default border
                                            },
                                            width: CELL_WIDTH,
                                            filter: false, // Disable filter
                                        },
                                        {
                                            headerName: 'AC',
                                            field: `${periodField}_ac`,
                                            valueGetter: params => {
                                                const capacity = params.data.capacity ? params.data.capacity.find(c => c.start_date === period.start_date && c.end_date === period.end_date) : null;
                                                return capacity ? capacity.available_capacity : '';
                                            },
                                            cellStyle: params => {
                                                const capacity = params.data.capacity ? params.data.capacity.find(c => c.start_date === period.start_date && c.end_date === period.end_date) : null;
                                                if (capacity) {
                                                    const { available_capacity: AC } = capacity;
                                                    if (AC < 0) return { backgroundColor: 'lightcoral', fontWeight: 'bold' }; // Red
                                                    if (AC === 0) return { backgroundColor: 'lightblue', fontWeight: 'bold' }; // Blue
                                                    if (AC > 0) return { backgroundColor: 'lightgreen', fontWeight: 'bold' }; // Green
                                                }
                                                return null; // Default style
                                            },
                                            width: CELL_WIDTH,
                                            filter: false, // Disable filter
                                        },
                                        {
                                            headerName: 'P',
                                            field: `${periodField}_p`,
                                            valueGetter: params => {
                                                const capacity = params.data.capacity ? params.data.capacity.find(c => c.start_date === period.start_date && c.end_date === period.end_date) : null;
                                                return capacity ? capacity.allocation_hours_planned : '';
                                            },
                                            cellStyle: params => {
                                                const capacity = params.data.capacity ? params.data.capacity.find(c => c.start_date === period.start_date && c.end_date === period.end_date) : null;
                                                if (capacity) {
                                                    const { available_capacity: AC } = capacity;
                                                    if (AC < 0) return { backgroundColor: 'lightcoral', fontWeight: 'bold' }; // Red
                                                    if (AC === 0) return { backgroundColor: 'lightblue', fontWeight: 'bold' }; // Blue
                                                    if (AC > 0) return { backgroundColor: 'lightgreen', fontWeight: 'bold' }; // Green
                                                }
                                                return null; // Default style
                                            },
                                            width: CELL_WIDTH,
                                            filter: false, // Disable filter
                                        },
                                        {
                                            headerName: 'A',
                                            field: `${periodField}_a`,
                                            valueGetter: params => {
                                                const capacity = params.data.capacity ? params.data.capacity.find(c => c.start_date === period.start_date && c.end_date === period.end_date) : null;
                                                return capacity ? capacity.allocation_hours_actual : '';
                                            },
                                            cellStyle: params => {
                                                const capacity = params.data.capacity ? params.data.capacity.find(c => c.start_date === period.start_date && c.end_date === period.end_date) : null;
                                                if (capacity) {
                                                    const { available_capacity: AC } = capacity;
                                                    if (AC < 0) return { backgroundColor: 'lightcoral', fontWeight: 'bold', borderRight: '2px solid black' }; // Red
                                                    if (AC === 0) return { backgroundColor: 'lightblue', fontWeight: 'bold', borderRight: '2px solid black' }; // Blue
                                                    if (AC > 0) return { backgroundColor: 'lightgreen', fontWeight: 'bold', borderRight: '2px solid black' }; // Green
                                                }
                                                return { borderRight: '2px solid black' }; // Default border
                                            },
                                            width: CELL_WIDTH,
                                            filter: false, // Disable filter
                                        },
                                    ],
                                });
                            });
                        }

                        const rowData = results.map(result => {
                            const row = {
                                resource_id: result.resource.resource_id,
                                resource_name: result.resource.resource_name,
                                resource_email: result.resource.resource_email,
                                resource_type: result.resource.resource_type,
                                strategic_portfolio: result.resource.strategic_portfolio,
                                product_line: result.resource.product_line,
                                manager_name: result.resource.manager_name,
                                manager_email: result.resource.manager_email,
                                resource_role: result.resource.resource_role,
                                timesheet_resource_name: result.resource.timesheet_resource_name,
                                responsibility: result.resource.responsibility,
                                skillset: result.resource.skillset,
                                comments: result.resource.comments,
                                yearly_capacity: result.resource.yearly_capacity,
                                capacity: result.capacity
                            };

                            result.capacity.forEach(period => {
                                const periodField = `${period.start_date || ''}_to_${period.end_date || ''}`;
                                row[`${periodField}_tc`] = period.total_capacity;
                                row[`${periodField}_ac`] = period.available_capacity;
                                row[`${periodField}_p`] = period.allocation_hours_planned;
                                row[`${periodField}_a`] = period.allocation_hours_actual;
                            });

                            return row;
                        });

                        setResourcesData(rowData);
                        setRowData(rowData);
                        setColumnDefs(columnDefs);

                        // --- FIX: If a resource is selected, update its chart with new interval data ---
                        if (selectedResource) {
                            const found = rowData.find(r => r.resource_id === selectedResource.resource_id);
                            if (found) {
                                updateChart(found.capacity);
                            }
                        }
                    })
                    .catch(error => console.error('Error loading resource capacities:', error));
            })
            .catch(error => console.error('Error loading resources:', error));
    };

    const loadResourceAllocationsByResource = (resourceId) => {
        fetch(`${API_BASE_URL}/allocations/resource/${resourceId}`)
            .then(response => response.json())
            .then(data => {
                const projectMap = {};
                const resourceMap = {};

                fetch(`${API_BASE_URL}/projects`)
                    .then(response => response.json())
                    .then(projects => {
                        projects.forEach(project => {
                            projectMap[project.project_id] = project.project_name;
                        });

                        fetch(`${API_BASE_URL}/resources`)
                            .then(response => response.json())
                            .then(resources => {
                                resources.forEach(resource => {
                                    resourceMap[resource.resource_id] = resource.resource_name;
                                });

                                data.forEach(allocation => {
                                    allocation.project_name = projectMap[allocation.project_id];
                                    allocation.resource_name = resourceMap[allocation.resource_id];
                                });

                                setAllocationRowData(data);
                            })
                            .catch(error => console.error('Error loading resources:', error));
                    })
                    .catch(error => console.error('Error loading projects:', error));
            })
            .catch(error => console.error('Error loading resource allocations:', error));
    };

    const loadStrategicPortfolios = () => {
        fetch(`${API_BASE_URL}/strategic_portfolios`)
            .then(response => response.json())
            .then(data => {
                const strategicPortfolioRadios = document.getElementById('strategic_portfolio_radios');
                if (strategicPortfolioRadios) {
                    strategicPortfolioRadios.innerHTML = '';
                    data.forEach(item => {
                        const radio = document.createElement('div');
                        radio.className = 'form-check form-check-inline';
                        radio.innerHTML = `
                            <input class="form-check-input" type="radio" name="strategic_portfolio" id="portfolio_${item.strategic_portfolio}" value="${item.strategic_portfolio}" required>
                            <label class="form-check-label" for="portfolio_${item.strategic_portfolio}">${item.strategic_portfolio}</label>
                        `;
                        strategicPortfolioRadios.appendChild(radio);
                    });
                }
            })
            .catch(error => console.error('Error loading strategic portfolios:', error));
    };

    const loadManagers = () => {
        fetch(`${API_BASE_URL}/managers`)
            .then(response => response.json())
            .then(data => {
                const managerSelect = document.getElementById('manager_name');
                if (managerSelect) {
                    managerSelect.innerHTML = '';
                    data.forEach(manager => {
                        const option = document.createElement('option');
                        option.value = manager.manager_name;
                        option.textContent = manager.manager_name;
                        managerSelect.appendChild(option);
                    });
                }
            })
            .catch(error => console.error('Error loading managers:', error));
    };

    const loadResourceRoles = () => {
        fetch(`${API_BASE_URL}/resource_roles`)
            .then(response => response.json())
            .then(data => {
                const resourceRoleSelect = document.getElementById('resource_role');
                if (resourceRoleSelect) {
                    resourceRoleSelect.innerHTML = '';
                    data.forEach(role => {
                        const option = document.createElement('option');
                        option.value = role.role_name;
                        option.textContent = role.role_name;
                        resourceRoleSelect.appendChild(option);
                    });
                }
            })
            .catch(error => console.error('Error loading resource roles:', error));
    };

    const populateFilterDropdowns = () => {
        fetch(`${API_BASE_URL}/strategic_portfolios`)
            .then(response => response.json())
            .then(data => {
                const strategicPortfolioFilter = document.getElementById('filter_strategic_portfolio');
                if (strategicPortfolioFilter) {
                    data.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.strategic_portfolio;
                        option.textContent = item.strategic_portfolio;
                        strategicPortfolioFilter.appendChild(option);
                    });
                }
            })
            .catch(error => console.error('Error loading strategic portfolios:', error));

        fetch(`${API_BASE_URL}/managers`)
            .then(response => response.json())
            .then(data => {
                const managerNameFilter = document.getElementById('filter_manager_name');
                if (managerNameFilter) {
                    data.forEach(manager => {
                        const option = document.createElement('option');
                        option.value = manager.manager_name;
                        option.textContent = manager.manager_name;
                        managerNameFilter.appendChild(option);
                    });
                }
            })
            .catch(error => console.error('Error loading managers:', error));
    };

    const applyFilters = () => {
        const strategicPortfolioElement = document.getElementById('filter_strategic_portfolio');
        const managerNameElement = document.getElementById('filter_manager_name');
        const capacityFilterElement = document.getElementById('filter_capacity');

        const strategicPortfolio = strategicPortfolioElement ? strategicPortfolioElement.value : '';
        const managerName = managerNameElement ? managerNameElement.value : '';
        const capacityFilterValue = capacityFilterElement ? capacityFilterElement.value : '';

        const filteredData = resourcesData.filter(resource => {
            let matches = true;

            if (strategicPortfolio && resource.strategic_portfolio !== strategicPortfolio) {
                matches = false;
            }

            if (managerName && resource.manager_name !== managerName) {
                matches = false;
            }

            if (capacityFilterValue) {
                const capacityMatches = resource.capacity.some(period => {
                    const AC = period.available_capacity || 0;
                    const P = period.allocation_hours_planned || 0;
                    const A = period.allocation_hours_actual || 0;

                    switch (capacityFilterValue) {
                        case 'ac_equals_p':
                            return AC === P; // AC = P
                        case 'ac_less_p':
                            return AC < P; // AC < P
                        case 'ac_greater_p':
                            return AC > P; // AC > P
                        case 'ac_equals_a':
                            return AC === A; // AC = A
                        case 'ac_less_a':
                            return AC < A; // AC < A
                        case 'ac_greater_a':
                            return AC > A; // AC > A
                        case 'p_equals_a':
                            return P === A; // P = A
                        case 'p_less_a':
                            return P < A; // P < A
                        case 'p_greater_a':
                            return P > A; // P > A
                        default:
                            return false;
                    }
                });

                if (!capacityMatches) {
                    matches = false;
                }
            }

            return matches;
        });

        setRowData(filteredData);
    };

    const resetFilters = () => {
        setCapacityFilter('');
        setStartDate(`${new Date().getFullYear()}-01-01`);
        setEndDate(`${new Date().getFullYear()}-12-31`);
        setIntervalValue('Weekly');
        loadResourceCapacityAllocation(`${new Date().getFullYear()}-01-01`, `${new Date().getFullYear()}-12-31`, 'Weekly');
        
        const capacityFilterElement = document.getElementById('filter_capacity');
        const strategicPortfolioElement = document.getElementById('filter_strategic_portfolio');
        const managerNameElement = document.getElementById('filter_manager_name');

        if (capacityFilterElement) capacityFilterElement.value = '';
        if (strategicPortfolioElement) strategicPortfolioElement.value = '';
        if (managerNameElement) managerNameElement.value = '';
    };

    const scrollToChart = () => {
        if (chartContainerRef.current) {
            chartContainerRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };
    
    const onRowClicked = (event) => {
        setSelectedResource(event.data);
        loadResourceAllocationsByResource(event.data.resource_id);
        updateChart(event.data.capacity);
        setTimeout(() => {
            scrollToChart();
        }, 0);

        // Fetch portfolio-level line chart data
        fetchPortfolioLineChartData(
            event.data.strategic_portfolio,
            event.data.product_line,
            startDate,
            endDate,
            interval
        );
    };

    // Define consistent colors for all charts
    const CHART_COLORS = {
        totalCapacity: { borderColor: 'blue', backgroundColor: 'rgba(0, 0, 255, 0.1)' },
        availableCapacity: { borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)' },
        planned: { borderColor: 'rgba(153, 102, 255, 1)', backgroundColor: 'rgba(153, 102, 255, 0.2)' },
        actual: { borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.2)' }
    };

    useEffect(() => {
        loadResourceCapacityAllocation(startDate, endDate, interval);
        loadStrategicPortfolios();
        loadManagers();
        loadResourceRoles();
        populateFilterDropdowns();

        // --- FIX: Update chart when interval changes and a resource is selected ---
        if (selectedResource && selectedResource.capacity) {
            updateChart(selectedResource.capacity);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, interval]);

    // Fetch portfolio-level line chart data
    const fetchPortfolioLineChartData = async (strategicPortfolio, productLine, startDate, endDate, interval) => {
        console.log('fetchPortfolioLineChartData called with:', { strategicPortfolio, productLine, startDate, endDate, interval });
        if (!strategicPortfolio) {
            console.log('No strategic portfolio provided, setting portfolioLineChartData to null');
            setPortfolioLineChartData(null);
            return;
        }
        try {
            const params = new URLSearchParams({
                strategic_portfolio: strategicPortfolio,
                interval,
            });
            if (productLine) params.append('product_line', productLine);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            console.log('Fetching portfolio data with params:', params.toString()); // Debug log
            const response = await fetch(`${API_BASE_URL}/resource_capacity_allocation_per_portfolio?${params.toString()}`);
            if (!response.ok) {
                console.error(`API endpoint returned ${response.status}: ${response.statusText}`);
                throw new Error(`Failed to fetch portfolio line chart data: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();

            console.log('Portfolio API response:', data); // Debug log

            // The new API response is an object with grand totals and an "intervals" array
            const intervals = data.intervals || [];
            console.log('Portfolio intervals:', intervals); // Debug log
            
            // Handle different field names based on interval type
            const labels = intervals.map(period => {
                if (interval === 'Weekly') {
                    return period.week_start || period.start_date || '';
                } else if (interval === 'Monthly') {
                    return period.month || period.start_date || '';
                }
                return period.start_date || '';
            });
            const totalCapacity = intervals.map(period => period.total_capacity || 0);
            const planned = intervals.map(period => period.allocation_hours_planned || 0);
            const actual = intervals.map(period => period.allocation_hours_actual || 0);
            const available = intervals.map(period => period.available_capacity || 0);
            const resourceDetails = intervals.map(period => period.resources || []);

            const chartData = {
                labels,
                datasets: [
                    {
                        label: 'Total Capacity',
                        data: totalCapacity,
                        borderColor: CHART_COLORS.totalCapacity.borderColor,
                        backgroundColor: CHART_COLORS.totalCapacity.backgroundColor,
                        fill: false,
                    },
                    {
                        label: 'Available Capacity',
                        data: available,
                        borderColor: CHART_COLORS.availableCapacity.borderColor,
                        backgroundColor: CHART_COLORS.availableCapacity.backgroundColor,
                        fill: true,
                    },
                    {
                        label: 'Planned Allocation',
                        data: planned,
                        borderColor: CHART_COLORS.planned.borderColor,
                        backgroundColor: CHART_COLORS.planned.backgroundColor,
                        fill: true,
                    },
                    {
                        label: 'Actual Allocation',
                        data: actual,
                        borderColor: CHART_COLORS.actual.borderColor,
                        backgroundColor: CHART_COLORS.actual.backgroundColor,
                        fill: true,
                    },
                ],
                resourceDetails,
                // Optionally, you can expose grand totals for display elsewhere:
                grandTotals: {
                    grand_total_capacity: data.grand_total_capacity,
                    grand_total_allocation_hours_planned: data.grand_total_allocation_hours_planned,
                    grand_total_allocation_hours_actual: data.grand_total_allocation_hours_actual,
                    grand_total_available_capacity: data.grand_total_available_capacity,
                    strategic_portfolio: data.strategic_portfolio,
                    product_line: data.product_line,
                }
            };

            console.log('Portfolio chart data:', chartData); // Debug log
            setPortfolioLineChartData(chartData);
        } catch (err) {
            setPortfolioLineChartData(null);
            console.error('Error fetching portfolio line chart:', err);
            if (err.message.includes('404')) {
                console.warn('Portfolio API endpoint not found. The portfolio chart will not be displayed.');
                console.warn('Please check if the API endpoint "/resource_capacity_allocation_per_portfolio" exists.');
            }
        }
    };

    // Also update portfolio chart when interval/start/end changes and a resource is selected
    useEffect(() => {
        if (selectedResource) {
            fetchPortfolioLineChartData(
                selectedResource.strategic_portfolio,
                selectedResource.product_line,
                startDate,
                endDate,
                interval
            );
        }
        // eslint-disable-next-line
    }, [interval, startDate, endDate, selectedResource]);

    const updateChart = (capacityData) => {
        if (!capacityData || !Array.isArray(capacityData) || capacityData.length === 0) {
            setChartData({ labels: [], datasets: [] });
            return;
        }

        // For both Weekly and Monthly, show labels every two periods for spacing
        let labels;
        labels = capacityData.map((period, idx) => {
            // Show label for every 2nd period, else empty string for spacing
            if (idx % 2 === 0) {
                // Handle different field names based on interval type
                if (interval === 'Weekly') {
                    return period.week_start || period.start_date || '';
                } else if (interval === 'Monthly') {
                    return period.month || period.start_date || '';
                }
                return period.start_date || '';
            }
            return '';
        });

        const capacityValues = capacityData.map(period => period.total_capacity);
        const availableValues = capacityData.map(period => period.available_capacity);
        const plannedValues = capacityData.map(period => period.allocation_hours_planned);
        const actualValues = capacityData.map(period => period.allocation_hours_actual);

        const newChartData = {
            labels: labels,
            datasets: [
                {
                    label: 'Total Capacity',
                    data: capacityValues,
                    borderColor: CHART_COLORS.totalCapacity.borderColor,
                    backgroundColor: CHART_COLORS.totalCapacity.backgroundColor,
                    fill: false
                },
                {
                    label: 'Available Capacity',
                    data: availableValues,
                    borderColor: CHART_COLORS.availableCapacity.borderColor,
                    backgroundColor: CHART_COLORS.availableCapacity.backgroundColor,
                    fill: true
                },
                {
                    label: 'Planned Allocation',
                    data: plannedValues,
                    borderColor: CHART_COLORS.planned.borderColor,
                    backgroundColor: CHART_COLORS.planned.backgroundColor,
                    fill: true
                },
                {
                    label: 'Actual Allocation',
                    data: actualValues,
                    borderColor: CHART_COLORS.actual.borderColor,
                    backgroundColor: CHART_COLORS.actual.backgroundColor,
                    fill: true
                }
            ]
        };

        setChartData(newChartData);
    };

    // Create portfolio chart options as a function to access portfolioLineChartData
    const getPortfolioLineChartOptions = () => ({
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 2,
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    title: function (tooltipItems) {
                        const label = tooltipItems[0].label;
                        return `Period: ${label}`;
                    },
                    label: function (tooltipItem) {
                        const datasetLabel = tooltipItem.dataset.label;
                        const dataPointValue = tooltipItem.raw;
                        // Access resourceDetails from the portfolioLineChartData state
                        const resourceDetails = portfolioLineChartData?.resourceDetails?.[tooltipItem.dataIndex] || [];
                        const mainLabel = `${datasetLabel}: ${dataPointValue}`;
                        if (!resourceDetails.length) return mainLabel;
                        const details = resourceDetails.map(resource => {
                            const info = `${resource.resource_name || 'Unknown'} (${resource.resource_email || 'Unknown'})`;
                            if (datasetLabel === 'Total Capacity') {
                                return `${info} - Capacity: ${Number(resource.total_capacity || 0).toFixed(1)} Hrs.`;
                            } else if (datasetLabel === 'Available Capacity') {
                                return `${info} - Available: ${Number(resource.available_capacity || 0).toFixed(1)} Hrs.`;
                            } else if (datasetLabel === 'Planned Allocation') {
                                return `${info} - Planned: ${resource.allocation_hours_planned || 0} Hrs.`;
                            } else if (datasetLabel === 'Actual Allocation') {
                                return `${info} - Actual: ${resource.allocation_hours_actual || 0} Hrs.`;
                            }
                            return info;
                        });
                        return [mainLabel, ...details];
                    }
                }
            }
        },
        scales: {
            x: { ticks: { font: { size: 10 } } },
            y: { title: { display: true, text: 'Hours' } }
        }
    });

    // Chart.js options for the line chart with custom tooltip
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    // Show period information in the tooltip title
                    title: function (tooltipItems) {
                        const idx = tooltipItems[0].dataIndex;
                        const period = selectedResource?.capacity?.[idx];
                        if (!period) return '';
                        
                        // Handle different field names based on interval type
                        if (interval === 'Weekly') {
                            const start = period.week_start || period.start_date || '';
                            const end = period.week_end || period.end_date || '';
                            return `Week: ${start} to ${end}`;
                        } else if (interval === 'Monthly') {
                            const month = period.month || period.start_date || '';
                            return `Month: ${month}`;
                        }
                        
                        // Fallback to original logic
                        const start = period.start_date || '';
                        const end = period.end_date || '';
                        return `Period: ${start} to ${end}`;
                    },
                    // Default label
                    label: function (tooltipItem) {
                        const datasetLabel = tooltipItem.dataset.label || '';
                        const value = tooltipItem.formattedValue;
                        return `${datasetLabel}: ${value}`;
                    }
                }
            }
        }
    };

    const [columnDefs, setColumnDefs] = useState([
        { headerName: 'Colleague Name', field: 'resource_name' },
        { headerName: 'Colleague Email', field: 'resource_email' },
        { headerName: 'Resource Type', field: 'resource_type' },
        { headerName: 'Strategic Portfolio', field: 'strategic_portfolio' },
        { headerName: 'Manager Name', field: 'manager_name' },
        { headerName: 'Manager Email', field: 'manager_email' },
        { headerName: 'Colleague Role', field: 'resource_role' },
        { headerName: 'Colleague Type', field: 'resource_type' },
        { headerName: 'Responsibility', field: 'responsibility' },
        { headerName: 'Skillset', field: 'skillset' },
        { headerName: 'Comments', field: 'comments' },
        { headerName: 'Yearly Capacity', field: 'yearly_capacity' }
    ]);

    const allocationColumnDefs = [
        { headerName: 'Project ID', field: 'project_id' },
        { headerName: 'Project Name', field: 'project_name' },
        { headerName: 'Colleague Name', field: 'resource_name' },
        { headerName: 'Colleague Role', field: 'resource_role' },
        { headerName: 'Colleague Type', field: 'resource_type' },
        { headerName: 'Allocation Start Date (Planned)', field: 'allocation_start_date' },
        { headerName: 'Allocation End Date (Planned)', field: 'allocation_end_date' },
        { headerName: 'Allocation Percentage (Planned)', field: 'allocation_pct' },
        { headerName: 'Allocation Hrs. Per Week (Planned)', field: 'allocation_hrs_per_week' },
        { headerName: 'Allocation Hours (Planned)', field: 'resource_hours_planned' }, // Renamed from Number of Hours
        { headerName: 'Allocation Cost (Planned)', field: 'resource_cost_planned' }, // Renamed from Resource Cost
        { headerName: 'Allocation Hours (Actual)', field: 'resource_hours_actual' }, // New field
        { 
            headerName: 'Allocation Cost (Actual)', 
            field: 'resource_cost_actual', 
            valueFormatter: params => params.value ? params.value.toFixed(2) : '0.00' // Ensure two decimal places
        },
        { headerName: 'Timesheet Start Date', field: 'timesheet_start_date' }, // New field
        { headerName: 'Timesheet End Date', field: 'timesheet_end_date' } // New field
    ];

    const handleResourceModalClose = () => {
        setShowResourcesModal(false);
        loadResourceCapacityAllocation(startDate, endDate, interval);
    };

    const [gridApi, setGridApi] = useState(null);

    const onGridReady = params => {
        setGridApi(params.api);
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Resources');

        // Add headers
        const headers = columnDefs.map(col => col.headerName);
        const headerRow = worksheet.addRow(headers);

        // Style header row
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9E1F2' } }; // Light blue background
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
        });

        // Add data rows
        gridApi.forEachNodeAfterFilterAndSort((node) => {
            const rowData = columnDefs.map(col => node.data[col.field] || '');
            const row = worksheet.addRow(rowData);

            // Apply styles to cells based on AG Grid cell styles
            row.eachCell((cell, colNumber) => {
                const field = columnDefs[colNumber - 1]?.field;
                const cellStyle = gridApi.getCellStyle({ rowIndex: node.rowIndex, colId: field });

                if (cellStyle?.backgroundColor) {
                    const hexColor = cellStyle.backgroundColor.replace('#', '').toUpperCase();
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexColor } };
                }

                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });

        // Adjust column widths
        worksheet.columns.forEach((column, index) => {
            column.width = headers[index]?.length + 5 || 15; // Adjust width based on header length
        });

        // Generate Excel file and trigger download
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'Resources.xlsx');
    };

    return (
        <div>
            <div className="date-controls">
                <label htmlFor="start_date" style={{ paddingTop: '5px'}}>Start Date:</label>
                <input type="date" id="start_date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-control" />
                <label htmlFor="end_date" style={{ paddingTop: '6px'}}>End Date:</label>
                <input type="date" id="end_date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-control" />
            </div>
            <div id="interval_radios" style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ marginRight: '40px' }}>Interval:</label>
                <div style={{ marginRight: '10px' }}>
                    <input type="radio" name="interval" value="Weekly" checked={interval === 'Weekly'} onChange={(e) => setIntervalValue(e.target.value)} />
                    <label style={{ marginLeft: '5px' }}>Weekly</label>
                </div>
                <div>
                    <input type="radio" name="interval" value="Monthly" checked={interval === 'Monthly'} onChange={(e) => setIntervalValue(e.target.value)} />
                    <label style={{ marginLeft: '5px' }}>Monthly</label>
                </div>
            </div>
            <div className="filter-controls" style={{ display: 'flex', alignItems: 'center', paddingBottom: '20px', paddingTop: '0px' }}>
                <label htmlFor="filter_capacity" style={{ marginRight: '10px', paddingTop: '10px' }}>Capacity Filter:</label>
                <select id="filter_capacity" className="form-control" style={{ width: '200px' }} onChange={(e) => { setCapacityFilter(e.target.value); applyFilters(); }}>
                    <option value="">Select Filter</option>
                    <option value="ac_equals_p">AC = P</option>
                    <option value="ac_less_p">AC &lt; P</option>
                    <option value="ac_greater_p">AC &gt; P</option>
                    <option value="ac_equals_a">AC = A</option>
                    <option value="ac_less_a">AC &lt; A</option>
                    <option value="ac_greater_a">AC &gt; A</option>
                    <option value="p_equals_a">P = A</option>
                    <option value="p_less_a">P &lt; A</option>
                    <option value="p_greater_a">P &gt; A</option>
                </select>
                <button className="btn btn-primary" style={{ marginLeft: '10px', height: '25px', paddingBottom: '30px' }} onClick={resetFilters}>Reset Filter</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title="Export Grid Data">
                        <div style={{ fontSize: '40px', cursor: 'pointer', color: 'green', paddingBottom: '5px', paddingRight: '50px' }}>
                            <FaFileExcel onClick={exportToExcel} />
                        </div>
                    </Tooltip>
                </div>
                <div className="legend" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap', fontSize: '14px', gap: '50px', whiteSpace: 'nowrap'}}>
                    <div style={{ fontWeight: 'bold' }}>
                        TC: Total Capacity  AC: Available Capacity  P: Planned Allocation  A: Actual Allocation
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '20px', height: '20px', backgroundColor: 'lightcoral' }}></div>
                        <span>P &gt; TC or A &gt; TC</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '20px', height: '20px', backgroundColor: 'lightgreen' }}></div>
                        <span>P &lt; TC and A &lt; TC</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '20px', height: '20px', backgroundColor: 'lightblue' }}></div>
                        <span>P = TC and A = TC</span>
                    </div>
                </div>
            </div>
            <div id="resources-grid" className="ag-theme-alpine" style={{ width: '100%', height: '500px', marginTop: '10px' }}>
                <AgGridReact
                    columnDefs={columnDefs}
                    rowData={rowData}
                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                    rowSelection={{ mode: "singleRow" }}
                    domLayout="normal"
                    onRowClicked={onRowClicked}
                    onGridReady={onGridReady}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px', alignItems: 'center', gap: '10px' }}>
                <button className="btn btn-primary" onClick={() => setShowViewTimeOffModal(true)}>View Time Off</button>
                <button className="btn btn-secondary" style={{ marginLeft: '10px' }} onClick={() => setShowAddTimeOffModal(true)}>Add Time Off</button>
                <button className="btn btn-success" style={{ marginLeft: '10px' }} onClick={() => setShowResourcesModal(true)}>Add Colleague</button>
                <Tooltip title="New Resource Template">
                    <a href="/ExcelTemplates/Resource_Template.xlsx" download>
                        <FaPaperclip style={{ fontSize: '40px', cursor: 'pointer', color: 'green', paddingTop: '5px' }} />
                    </a>
                </Tooltip>
            </div>
            {selectedResource && (
                <div id="allocation-grid" className="ag-theme-alpine" style={{ width: '100%', height: '200px', marginTop: '20px' }}>
                    <AgGridReact
                        columnDefs={allocationColumnDefs}
                        rowData={allocationRowData}
                        defaultColDef={{ sortable: true, filter: true, resizable: true }}
                        rowSelection="single"
                        domLayout="normal"
                    />
                </div>
            )}
            {showViewTimeOffModal && (
                <ViewTimeOffModal onClose={() => setShowViewTimeOffModal(false)} resourceId={selectedResource ? selectedResource.resource_id : null} />
            )}
            {showAddTimeOffModal && (
                <AddTimeOffModal onClose={() => setShowAddTimeOffModal(false)} selectedResource={selectedResource} />
            )}
            {showResourcesModal && (
                <ResourcesModal onClose={handleResourceModalClose} keyboard={true} />
            )}
            <div>
                {/* Add centered label above the legend and chart */}
                {selectedResource && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '10px', marginTop: '30px' }}>
                        {`${selectedResource.resource_name} (${selectedResource.strategic_portfolio} - ${selectedResource.product_line})`}
                    </div>
                )}
                <div className="chart-container" style={{ display: 'flex', width: '95vw', height: '300px', paddingTop: '25px' }} ref={chartContainerRef}>
                    <Line ref={chartRef} data={chartData} options={chartOptions} />
                </div>
                {/* --- Portfolio-level line chart below resource chart --- */}
                {portfolioLineChartData && (
                    <div style={{ marginTop: '40px', marginBottom: '20px' }}>
                        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                            Portfolio Trend: {selectedResource?.strategic_portfolio}
                            {selectedResource?.product_line ? ` / ${selectedResource.product_line}` : ''}
                        </div>
                        <div style={{ width: '95vw', height: '300px', margin: '0 auto' }}>
                            <Line data={portfolioLineChartData} options={getPortfolioLineChartOptions()} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Resources;