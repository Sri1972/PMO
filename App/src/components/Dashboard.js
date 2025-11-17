import React, { useEffect, useState } from 'react';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement } from 'chart.js';
import { API_BASE_URL } from '../config';

// Register chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement);

const STRATEGIC_PORTFOLIO_FILTERS = [
    { label: 'All', value: 'All' },
    { label: 'Plan & Build', value: 'Plan & Build' },
    { label: 'Market & Sell', value: 'Market & Sell' },
    { label: 'Vehicles In Use', value: 'Vehicles In Use' }
];

const Dashboard = () => {
    const [allProjects, setAllProjects] = useState([]);
    const [selectedPortfolio, setSelectedPortfolio] = useState('All');
    const [projectTypeData, setProjectTypeData] = useState(null);
    const [businessLines, setBusinessLines] = useState([]);
    const [, setFilteredBusinessLines] = useState([]);
    const [selectedProductLine, setSelectedProductLine] = useState('');
    const [barData, setBarData] = useState(null);
    const [barDateRange, setBarDateRange] = useState('');
    const [projectBarCharts, setProjectBarCharts] = useState([]);
    const [, setFilteredProjects] = useState([]);
    const [portfolioTrendData, setPortfolioTrendData] = useState(null);

    // Date controls state
    const currentYear = new Date().getFullYear();
    const defaultStartDate = `${currentYear}-01-01`;
    const defaultEndDate = `${currentYear}-12-31`;

    const [inputStartDate, setInputStartDate] = useState(defaultStartDate);
    const [inputEndDate, setInputEndDate] = useState(defaultEndDate);
    const [chartStartDate, setChartStartDate] = useState(defaultStartDate);
    const [chartEndDate, setChartEndDate] = useState(defaultEndDate);
    const [dateError, setDateError] = useState('');

    // Add tab state
    const [activeTab, setActiveTab] = useState('Projects');

    // Fetch all projects
    useEffect(() => {
        fetch(`${API_BASE_URL}/projects`)
            .then(res => res.json())
            .then(data => setAllProjects(data));
    }, []);

    // Fetch all business lines
    useEffect(() => {
        fetch(`${API_BASE_URL}/business_lines`)
            .then(res => res.json())
            .then(data => setBusinessLines(data));
    }, []);

    // Update filtered business lines when portfolio changes
    useEffect(() => {
        if (selectedPortfolio === 'All') {
            setFilteredBusinessLines([]);
            setSelectedProductLine('');
        } else {
            const filtered = businessLines
                .filter(bl => (bl.strategic_portfolio || '').toLowerCase() === selectedPortfolio.toLowerCase())
                .map(bl => bl.product_line)
                .filter((v, i, arr) => v && arr.indexOf(v) === i); // Unique, non-empty
            setFilteredBusinessLines(filtered);
            setSelectedProductLine(''); // Reset product line on portfolio change
        }
    }, [selectedPortfolio, businessLines]);

    // Update pie chart data when filters change
    useEffect(() => {
        let filtered = allProjects;
        if (selectedPortfolio !== 'All') {
            filtered = filtered.filter(
                p => (p.strategic_portfolio || '').toLowerCase() === selectedPortfolio.toLowerCase()
            );
        }
        if (selectedProductLine) {
            filtered = filtered.filter(
                p => (p.product_line || '').toLowerCase() === selectedProductLine.toLowerCase()
            );
        }
        // Count projects by type
        const typeCounts = {};
        filtered.forEach(project => {
            const type = project.project_type || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        const labels = Object.keys(typeCounts);
        const values = Object.values(typeCounts);
        const total = values.reduce((a, b) => a + b, 0);

        setProjectTypeData({
            labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'
                ],
            }],
            total
        });
    }, [allProjects, selectedPortfolio, selectedProductLine]);

    // Fetch both main bar data, portfolio trend, and project bar charts in parallel (single API call for portfolio)
    useEffect(() => {
        // --- PATCH: Always show all project bar charts when "All" is selected ---
        let filtered = allProjects;
        if (selectedPortfolio !== 'All') {
            filtered = filtered.filter(
                p => (p.strategic_portfolio || '').toLowerCase() === selectedPortfolio.toLowerCase()
            );
        }
        if (selectedProductLine) {
            filtered = filtered.filter(
                p => (p.product_line || '').toLowerCase() === selectedProductLine.toLowerCase()
            );
        }
        const startDate = chartStartDate;
        const endDate = chartEndDate;

        // Only fetch bar/trend data for a specific portfolio, not for "All"
        if (selectedPortfolio === 'All') {
            setBarData(null);
            setBarDateRange('');
            setPortfolioTrendData(null);
        } else {
            // ...existing code for paramsWeekly, paramsMonthly, fetchAll for bar/trend...
            // ...existing code...
        }

        // Always fetch project bar charts for all filtered projects (even for "All")
        // --- PATCH: Use Promise.allSettled for concurrency (multi-threaded in browser terms) ---
        const fetchProjectBars = async () => {
            const projectBarPromises = filtered.map(project =>
                fetch(`${API_BASE_URL}/project_capacity_allocation/${project.project_id}?interval=Weekly`)
                    .then(async res => {
                        if (!res.ok) return { project, data: null };
                        const data = await res.json();
                        if (!data || data.error || !Array.isArray(data.intervals) || data.intervals.length === 0) {
                            return { project, data: null };
                        }
                        // Prepare line chart data from intervals
                        const lineData = {
                            labels: data.intervals.map(i => i.start_date), // Use start_date for labels
                            datasets: [
                                {
                                    label: 'Planned',
                                    data: data.intervals.map(i => i.allocation_hours_planned || 0),
                                    borderColor: '#F9A825',
                                    backgroundColor: 'rgba(249,168,37,0.1)',
                                    fill: false,
                                    tension: 0.3
                                },
                                {
                                    label: 'Actual',
                                    data: data.intervals.map(i => i.allocation_hours_actual || 0),
                                    borderColor: '#00897B',
                                    backgroundColor: 'rgba(0,137,123,0.1)',
                                    fill: false,
                                    tension: 0.3
                                },
                                {
                                    label: 'Available',
                                    data: data.intervals.map(i => i.available_capacity || 0),
                                    borderColor: '#3949AB',
                                    backgroundColor: 'rgba(57,73,171,0.1)',
                                    fill: false,
                                    tension: 0.3
                                }
                            ]
                        };
                        return { project, data, lineData };
                    })
                    .catch(() => ({ project, data: null, lineData: null }))
            );
            const projectBarResultsSettled = await Promise.allSettled(projectBarPromises);
            const projectBarResults = projectBarResultsSettled
                .map(r => r.status === 'fulfilled' ? r.value : null)
                .filter(Boolean);

            const charts = projectBarResults
                .filter(({ data }) => data && typeof data === 'object')
                .map(({ project, data, lineData }) => ({
                    project_id: project.project_id,
                    project_name: project.project_name,
                    product_line: project.product_line,
                    barData: {
                        labels: [project.project_name + (project.product_line ? ` (${project.product_line})` : '')],
                        datasets: [
                            {
                                label: 'Planned Allocation',
                                data: [data.grand_total_allocation_hours_planned || 0],
                                backgroundColor: '#FFCE56',
                            },
                            {
                                label: 'Actual Allocation',
                                data: [data.grand_total_allocation_hours_actual || 0],
                                backgroundColor: '#FF6384',
                            },
                            {
                                label: 'Available Capacity',
                                data: [data.grand_total_available_capacity || 0],
                                backgroundColor: '#36A2EB',
                            }
                        ]
                    },
                    lineData // <-- add lineData for each project
                }));

            setProjectBarCharts(charts);
        };

        fetchProjectBars();

        // Only fetchAll for bar/trend if not "All"
        if (selectedPortfolio !== 'All') {
            const paramsWeekly = new URLSearchParams({
                strategic_portfolio: selectedPortfolio,
                start_date: startDate,
                end_date: endDate,
                interval: 'Weekly'
            });
            const paramsMonthly = new URLSearchParams({
                strategic_portfolio: selectedPortfolio,
                start_date: startDate,
                end_date: endDate,
                interval: 'Monthly'
            });
            if (selectedProductLine) {
                paramsWeekly.append('product_line', selectedProductLine);
                paramsMonthly.append('product_line', selectedProductLine);
            }
            const fetchAll = async () => {
                console.log('Dashboard: Fetching portfolio data with params:');
                console.log('Weekly:', paramsWeekly.toString());
                console.log('Monthly:', paramsMonthly.toString());
                
                const [weeklyData, monthlyData] = await Promise.all([
                    fetch(`${API_BASE_URL}/resource_capacity_allocation_per_portfolio?${paramsWeekly.toString()}`)
                        .then(async res => {
                            if (!res.ok) {
                                console.error(`Weekly API failed: ${res.status} ${res.statusText}`);
                                console.error(`URL: ${API_BASE_URL}/resource_capacity_allocation_per_portfolio?${paramsWeekly.toString()}`);
                                return null;
                            }
                            return res.json();
                        })
                        .catch(err => {
                            console.error('Weekly API error:', err);
                            return null;
                        }),
                    fetch(`${API_BASE_URL}/resource_capacity_allocation_per_portfolio?${paramsMonthly.toString()}`)
                        .then(async res => {
                            if (!res.ok) {
                                console.error(`Monthly API failed: ${res.status} ${res.statusText}`);
                                console.error(`URL: ${API_BASE_URL}/resource_capacity_allocation_per_portfolio?${paramsMonthly.toString()}`);
                                return null;
                            }
                            return res.json();
                        })
                        .catch(err => {
                            console.error('Monthly API error:', err);
                            return null;
                        })
                ]);
                if (!weeklyData || typeof weeklyData !== 'object') {
                    setBarData(null);
                    setBarDateRange('');
                } else {
                    setBarData({
                        capacity: weeklyData.grand_total_capacity || 0,
                        planned: weeklyData.grand_total_allocation_hours_planned || 0,
                        actual: weeklyData.grand_total_allocation_hours_actual || 0
                    });
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const options = { year: 'numeric', month: 'short', day: 'numeric' };
                    setBarDateRange(
                        `${start.toLocaleDateString(undefined, options)} to ${end.toLocaleDateString(undefined, options)}`
                    );
                }
                if (!monthlyData || !Array.isArray(monthlyData.intervals)) {
                    setPortfolioTrendData(null);
                } else {
                    setPortfolioTrendData({
                        labels: monthlyData.intervals.map(i => i.start_date), // Use start_date for labels
                        datasets: [
                            {
                                label: 'Planned',
                                data: monthlyData.intervals.map(i => i.allocation_hours_planned || 0),
                                borderColor: '#F9A825',
                                backgroundColor: 'rgba(249,168,37,0.1)',
                                fill: false,
                                tension: 0.3
                            },
                            {
                                label: 'Actual',
                                data: monthlyData.intervals.map(i => i.allocation_hours_actual || 0),
                                borderColor: '#00897B',
                                backgroundColor: 'rgba(0,137,123,0.1)',
                                fill: false,
                                tension: 0.3
                            },
                            {
                                label: 'Available',
                                data: monthlyData.intervals.map(i => i.available_capacity || 0),
                                borderColor: '#3949AB',
                                backgroundColor: 'rgba(57,73,171,0.1)',
                                fill: false,
                                tension: 0.3
                            }
                        ]
                    });
                }
            };
            fetchAll();
        }
    // eslint-disable-next-line
    }, [selectedPortfolio, selectedProductLine, allProjects, API_BASE_URL, chartStartDate, chartEndDate]);

    // Filter projects for current portfolio/product line
    useEffect(() => {
        let filtered = allProjects;
        if (selectedPortfolio !== 'All') {
            filtered = filtered.filter(
                p => (p.strategic_portfolio || '').toLowerCase() === selectedPortfolio.toLowerCase()
            );
        }
        if (selectedProductLine) {
            filtered = filtered.filter(
                p => (p.product_line || '').toLowerCase() === selectedProductLine.toLowerCase()
            );
        }
        setFilteredProjects(filtered);
    }, [allProjects, selectedPortfolio, selectedProductLine]);

    // Compute the max Y value across all project bar charts for consistent scaling
    // eslint-disable-next-line no-unused-vars
    const maxProjectBarY = React.useMemo(() => {
        if (!projectBarCharts.length) return 10;
        let max = 0;
        projectBarCharts.forEach(chart => {
            // Get the values from the API data for each project
            const planned = chart.barData.datasets[0]?.data[0] || 0;
            const actual = chart.barData.datasets[1]?.data[0] || 0;
            const available = chart.barData.datasets[2]?.data[0] || 0;
            max = Math.max(max, planned, actual, available);
        });
        // Round up to nearest 50 for a cleaner axis
        return Math.ceil(max / 50) * 50 || 50;
    }, [projectBarCharts]);

    // Pie chart options with custom plugin for drawing labels inside slices
    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    font: {
                        size: 8,
                        family: 'Arial'
                    },
                    boxWidth: 6,
                    boxHeight: 6,
                    color: '#333',
                    usePointStyle: true,
                    pointStyle: 'rect',
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percent = total ? ((value / total) * 100).toFixed(1) : 0;
                        return `${context.label}: ${value} (${percent}%)`;
                    }
                }
            }
        }
    };

    // Custom plugin to draw only percent inside pie slices
    const pieLabelPlugin = {
        id: 'pieLabelPlugin',
        afterDraw: (chart) => {
            const { ctx, data } = chart;
            if (!chart._active || chart._active.length === 0) return;

            ctx.save();
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            chart._active.forEach((active) => {
                const { datasetIndex, index } = active;
                const meta = chart.getDatasetMeta(datasetIndex);
                if (!meta || !meta.data || !meta.data[index]) return;

                const arc = meta.data[index];
                const { x, y } = arc.tooltipPosition();

                // Calculate the position for the label
                const labelX = x;
                const labelY = y;

                // Get the percentage value
                const total = data.datasets[datasetIndex].data.reduce((a, b) => a + b, 0);
                const value = data.datasets[datasetIndex].data[index];
                const percent = total ? ((value / total) * 100).toFixed(1) : 0;

                // Draw the label
                ctx.fillStyle = '#fff';
                ctx.fillText(`${percent}%`, labelX, labelY);
            });

            ctx.restore();
        }
    };

    // Pie chart color scheme (unchanged)
    // eslint-disable-next-line no-unused-vars
    const pieChartColors = [
        '#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'
    ];

    // Bar chart color scheme (distinct from pie chart)
    const barChartColors = {
        actual: '#00897B',      // Teal
        planned: '#F9A825',     // Amber
        available: '#3949AB'    // Indigo
    };

    // Helper to build grouped bar datasets for capacity/allocation (side-by-side bars)
    function getGroupedBarDatasets(capacity, planned, actual, available) {
        // Use the available value directly if provided (for API data integrity)
        let availableVal = typeof available === 'number' ? available : Math.max(0, capacity - planned);
        const actualVal = Math.max(0, actual);
        const plannedVal = Math.max(0, planned - actualVal);

        return [
            {
                label: 'Actual Allocation',
                data: [actualVal],
                backgroundColor: barChartColors.actual,
            },
            {
                label: 'Planned Allocation',
                data: [plannedVal],
                backgroundColor: barChartColors.planned,
            },
            {
                label: 'Available Capacity',
                data: [availableVal],
                backgroundColor: barChartColors.available,
            }
        ];
    }

    // Helper: get unique product lines for a given strategic portfolio
    function getProductLinesForPortfolio(portfolio) {
        return businessLines
            .filter(bl => (bl.strategic_portfolio || '').toLowerCase() === portfolio.toLowerCase())
            .map(bl => bl.product_line)
            .filter((v, i, arr) => v && arr.indexOf(v) === i);
    }

    // State: selected product line for each portfolio
    const [portfolioProductLines, setPortfolioProductLines] = useState({});

    // Handler for dropdown change
    const handleProductLineChange = (portfolio, value) => {
        setPortfolioProductLines(prev => ({
            ...prev,
            [portfolio]: value
        }));
        // If the selected portfolio is active, update selectedProductLine as well
        if (selectedPortfolio === portfolio) {
            setSelectedProductLine(value);
        }
    };

    // When selectedPortfolio changes, update selectedProductLine from portfolioProductLines
    useEffect(() => {
        if (selectedPortfolio && selectedPortfolio !== 'All') {
            setSelectedProductLine(portfolioProductLines[selectedPortfolio] || '');
        } else {
            setSelectedProductLine('');
        }
    }, [selectedPortfolio, portfolioProductLines]);

    // Handler for Refresh Charts button
    const handleRefreshCharts = () => {
        if (!inputStartDate || !inputEndDate) {
            setDateError('Please select both start and end dates.');
            return;
        }
        if (inputEndDate <= inputStartDate) {
            setDateError('End date must be after start date.');
            return;
        }
        setDateError('');
        setChartStartDate(inputStartDate);
        setChartEndDate(inputEndDate);
    };

    // Helper to format date range for display
    function formatDateRange(start, end) {
        if (!start || !end) return '';
        const startD = new Date(start);
        const endD = new Date(end);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return `(${startD.toLocaleDateString(undefined, options)} to ${endD.toLocaleDateString(undefined, options)})`;
    }

    return (
        <div
            style={{
                padding: 30,
                minHeight: '100vh',
                width: '100vw',
                background: '#f5f6fa',
                boxSizing: 'border-box',
                overflowX: 'auto'
            }}
        >
            <div
                style={{
                    maxWidth: '1800px',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}
            >
                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: 0,
                    marginBottom: 24,
                    width: '100%',
                    justifyContent: 'center'
                }}>
                    <button
                        onClick={() => setActiveTab('Projects')}
                        style={{
                            padding: '12px 36px',
                            fontSize: 18,
                            fontWeight: 'bold',
                            border: 'none',
                            borderBottom: activeTab === 'Projects' ? '4px solid #1976d2' : '4px solid transparent',
                            background: activeTab === 'Projects' ? '#fff' : '#f5f6fa',
                            color: activeTab === 'Projects' ? '#1976d2' : '#888',
                            cursor: 'pointer',
                            outline: 'none',
                            borderTopLeftRadius: 12,
                            borderTopRightRadius: 12
                        }}
                    >
                        Projects
                    </button>
                    <button
                        onClick={() => setActiveTab('Resources')}
                        style={{
                            padding: '12px 36px',
                            fontSize: 18,
                            fontWeight: 'bold',
                            border: 'none',
                            borderBottom: activeTab === 'Resources' ? '4px solid #1976d2' : '4px solid transparent',
                            background: activeTab === 'Resources' ? '#fff' : '#f5f6fa',
                            color: activeTab === 'Resources' ? '#1976d2' : '#888',
                            cursor: 'pointer',
                            outline: 'none',
                            borderTopLeftRadius: 12,
                            borderTopRightRadius: 12
                        }}
                    >
                        Resources
                    </button>
                </div>

                {/* Tab content */}
                <div style={{ width: '100%' }}>
                    {activeTab === 'Projects' && (
                        <>
                            {/* Strategic Portfolio checkboxes and product line dropdowns in a card/frame */}
                            <div style={{
                                marginBottom: 18,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: '100%',
                            }}>
                                <div style={{
                                    background: '#f8f9fa',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '14px',
                                    padding: '18px 32px',
                                    display: 'flex',
                                    gap: '40px',
                                    alignItems: 'flex-end',
                                    boxShadow: '0 2px 8px rgba(25, 118, 210, 0.06)'
                                }}>
                                    {STRATEGIC_PORTFOLIO_FILTERS.map(opt => (
                                        <div
                                            key={opt.value}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                minWidth: 140,
                                                height: 80,
                                                justifyContent: 'flex-end'
                                            }}
                                        >
                                            <label style={{
                                                fontWeight: 'bold',
                                                fontSize: '16px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                marginBottom: 6,
                                                minHeight: 38
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPortfolio === opt.value}
                                                    onChange={() => {
                                                        setSelectedPortfolio(opt.value);
                                                        // Reset all dropdowns when a new checkbox is clicked
                                                        setPortfolioProductLines({});
                                                    }}
                                                    style={{
                                                        marginBottom: 6,
                                                        marginRight: 0,
                                                        transform: 'scale(1.2)'
                                                    }}
                                                />
                                                {opt.label}
                                            </label>
                                            {opt.value === 'All'
                                                ? <div style={{ height: 32, minWidth: 120 }}></div>
                                                : (
                                                    <select
                                                        style={{
                                                            minWidth: 120,
                                                            fontSize: '14px',
                                                            padding: '2px 6px',
                                                            borderRadius: 6,
                                                            border: '1px solid #bdbdbd',
                                                            background: '#fff'
                                                        }}
                                                        value={portfolioProductLines[opt.value] || ''}
                                                        onChange={e => handleProductLineChange(opt.value, e.target.value)}
                                                        disabled={getProductLinesForPortfolio(opt.value).length === 0}
                                                    >
                                                        <option value="">All</option>
                                                        {getProductLinesForPortfolio(opt.value).map(line => (
                                                            <option key={line} value={line}>{line}</option>
                                                        ))}
                                                    </select>
                                                )
                                            }
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pie Chart centered on top */}
                            <div style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 32
                            }}>
                                <div style={{
                                    width: '520px',
                                    height: '520px',
                                    background: '#fff',
                                    boxShadow: '0 2px 12px rgba(25, 118, 210, 0.08)',
                                    padding: '18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    borderRadius: '18px',
                                    justifyContent: 'center'
                                }}>
                                    <h2 style={{
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        marginBottom: '14px',
                                        color: 'black',
                                        letterSpacing: '1px',
                                        paddingTop: '20px',
                                        fontSize: '18px'
                                    }}>
                                        Project Type
                                    </h2>
                                    <div style={{ width: '100%', height: '340px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        {projectTypeData && (
                                            <Pie
                                                data={projectTypeData}
                                                options={{
                                                    ...pieOptions,
                                                    plugins: {
                                                        ...pieOptions.plugins,
                                                        legend: {
                                                            ...pieOptions.plugins.legend,
                                                            display: false // Hide default legend
                                                        }
                                                    }
                                                }}
                                                plugins={[pieLabelPlugin]}
                                                width={400}
                                                height={340}
                                            />
                                        )}
                                    </div>
                                    {/* Custom legend below and centered */}
                                    {projectTypeData && (
                                        <div style={{
                                            width: '100%',
                                            marginTop: '18px',
                                            display: 'flex',
                                            justifyContent: 'center'
                                        }}>
                                            <ul style={{
                                                listStyle: 'none',
                                                padding: 0,
                                                margin: 0,
                                                fontSize: '16px',
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '18px',
                                                justifyContent: 'center'
                                            }}>
                                                {projectTypeData.labels.map((label, i) => {
                                                    const value = projectTypeData.datasets[0].data[i];
                                                    const total = projectTypeData.datasets[0].data.reduce((a, b) => a + b, 0);
                                                    const percent = total ? ((value / total) * 100).toFixed(1) : 0;
                                                    return (
                                                        <li key={label} style={{ display: 'flex', alignItems: 'center' }}>
                                                            <span style={{
                                                                display: 'inline-block',
                                                                width: 16,
                                                                height: 16,
                                                                backgroundColor: projectTypeData.datasets[0].backgroundColor[i],
                                                                borderRadius: 4,
                                                                marginRight: 7,
                                                                border: '1px solid #ccc'
                                                            }}></span>
                                                            <span>{label}: <b>{value}</b> ({percent}%)</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Date controls and date range label */}
                            <div style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                marginBottom: 10
                            }}>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 18,
                                    marginBottom: 8
                                }}>
                                    <label style={{ fontWeight: 'bold', fontSize: 15 }}>Start Date:</label>
                                    <input
                                        type="date"
                                        value={inputStartDate}
                                        onChange={e => setInputStartDate(e.target.value)}
                                        style={{ fontSize: 15, padding: '4px 8px', borderRadius: 6, border: '1px solid #bdbdbd' }}
                                        max={inputEndDate}
                                    />
                                    <label style={{ fontWeight: 'bold', fontSize: 15 }}>End Date:</label>
                                    <input
                                        type="date"
                                        value={inputEndDate}
                                        onChange={e => setInputEndDate(e.target.value)}
                                        style={{ fontSize: 15, padding: '4px 8px', borderRadius: 6, border: '1px solid #bdbdbd' }}
                                        min={inputStartDate}
                                    />
                                    <button
                                        onClick={handleRefreshCharts}
                                        style={{
                                            marginLeft: 18,
                                            padding: '6px 18px',
                                            fontSize: 15,
                                            fontWeight: 'bold',
                                            borderRadius: 6,
                                            border: '1px solid #1976d2',
                                            background: '#1976d2',
                                            color: '#fff',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Refresh Charts
                                    </button>
                                </div>
                                {dateError && (
                                    <div style={{ color: 'red', fontSize: 14, marginBottom: 6 }}>{dateError}</div>
                                )}
                                <div style={{
                                    fontWeight: 'bold',
                                    fontSize: 16,
                                    textAlign: 'center',
                                    marginBottom: 18
                                }}>
                                    {formatDateRange(chartStartDate, chartEndDate)}
                                </div>
                            </div>

                            {/* Only render project bar charts grouped by Strategic Portfolio and Product Line */}
                            {projectBarCharts.length > 0 && (() => {
                                // Group by Strategic Portfolio, then Product Line
                                const grouped = {};
                                projectBarCharts.forEach(chart => {
                                    const project = allProjects.find(p => p.project_id === chart.project_id) || {};
                                    const portfolio = (project.strategic_portfolio || 'Unknown').trim();
                                    const productLine = (project.product_line || 'Unknown').trim();
                                    if (!grouped[portfolio]) grouped[portfolio] = {};
                                    if (!grouped[portfolio][productLine]) grouped[portfolio][productLine] = [];
                                    grouped[portfolio][productLine].push(chart);
                                });
                                // Helper to get max Y for a single chart
                                function getMaxY(chart) {
                                    const planned = chart.barData.datasets[0]?.data[0] || 0;
                                    const actual = chart.barData.datasets[1]?.data[0] || 0;
                                    const available = chart.barData.datasets[2]?.data[0] || 0;
                                    const max = Math.max(planned, actual, available);
                                    return Math.ceil(max / 50) * 50 || 50;
                                }
                                // --- PATCH: Store and render project-level line chart data ---
                                // We'll fetch and store line chart data for each project in a new state
                                // (We fetch it in the same API call as the bar chart, so we can store it in projectBarCharts)
                                // We'll update fetchProjectBars to include lineData for each project
                                // --- PATCH: fetchProjectBars ---
                                // ...existing code up to fetchProjectBars...
                                // (see below for the fetchProjectBars patch)
                                // --- END PATCH ---

                                return (
                                    <div style={{ marginTop: '20px', width: '100%' }}>
                                        {Object.entries(grouped).map(([portfolio, productLines]) => (
                                            <div key={portfolio} style={{
                                                border: '2px solid #1976d2',
                                                borderRadius: 14,
                                                marginBottom: 32,
                                                background: '#f8faff',
                                                padding: '18px 0 0 0'
                                            }}>
                                                <div style={{
                                                    fontWeight: 'bold',
                                                    fontSize: 20,
                                                    color: '#1976d2',
                                                    margin: '0 0 10px 0',
                                                    paddingLeft: 24
                                                }}>
                                                    {portfolio}
                                                </div>
                                                {Object.entries(productLines).map(([productLine, charts]) => (
                                                    <div key={productLine} style={{
                                                        borderTop: '1px solid #e0e0e0',
                                                        padding: '12px 0 0 0',
                                                        marginBottom: 0
                                                    }}>
                                                        <div style={{
                                                            fontWeight: 'bold',
                                                            fontSize: 16,
                                                            color: '#444',
                                                            margin: '0 0 10px 24px'
                                                        }}>
                                                            {productLine}
                                                        </div>
                                                        <div style={{
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: '36px',
                                                            justifyContent: 'flex-start',
                                                            padding: '0 24px 24px 24px'
                                                        }}>
                                                            {charts.map(chart => (
                                                                <div key={chart.project_id} style={{
                                                                    width: 420,
                                                                    background: '#fff',
                                                                    boxShadow: '0 2px 12px rgba(25, 118, 210, 0.08)',
                                                                    borderRadius: 14,
                                                                    padding: 0,
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    alignItems: 'center',
                                                                    marginBottom: 0,
                                                                    border: '1px solid #e0e0e0',
                                                                    overflow: 'hidden'
                                                                }}>
                                                                    <div style={{
                                                                        fontWeight: 'bold',
                                                                        fontSize: 15,
                                                                        margin: '18px 0 10px 0',
                                                                        textAlign: 'center',
                                                                        width: '100%'
                                                                    }}>
                                                                        {chart.project_name}
                                                                        {chart.product_line ? <span style={{ color: '#888', fontWeight: 'normal' }}> ({chart.product_line})</span> : null}
                                                                    </div>
                                                                    <div style={{
                                                                        width: '100%',
                                                                        height: 300,
                                                                        padding: '0 18px 0 18px',
                                                                        boxSizing: 'border-box'
                                                                    }}>
                                                                        <Bar
                                                                            data={{
                                                                                labels: chart.barData.labels,
                                                                                datasets: getGroupedBarDatasets(
                                                                                    (chart.barData.datasets[0].data[0] || 0) + (chart.barData.datasets[1].data[0] || 0) + (chart.barData.datasets[2].data[0] || 0),
                                                                                    (chart.barData.datasets[0].data[0] || 0) + (chart.barData.datasets[1].data[0] || 0),
                                                                                    chart.barData.datasets[1].data[0] || 0,
                                                                                    chart.barData.datasets[2].data[0]
                                                                                )
                                                                            }}
                                                                            options={{
                                                                                responsive: true,
                                                                                barPercentage: 0.6,
                                                                                maintainAspectRatio: false,
                                                                                plugins: {
                                                                                    legend: {
                                                                                        position: 'top',
                                                                                        labels: {
                                                                                            usePointStyle: true,
                                                                                            pointStyle: 'rect',
                                                                                            font: { size: 12, family: 'Arial' },
                                                                                            boxWidth : 6,
                                                                                            boxHeight: 6,
                                                                                            padding: 4,
                                                                                            color: '#333'
                                                                                        }
                                                                                    },
                                                                                    tooltip: {
                                                                                        callbacks: {
                                                                                            label: function(context) {
                                                                                                return `${context.dataset.label}: ${context.parsed.y}`;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                },
                                                                                scales: {
                                                                                    x: {
                                                                                        stacked: false,
                                                                                        title: { display: false }
                                                                                    },
                                                                                    y: {
                                                                                        stacked: false,
                                                                                        title: { display: true, text: 'Hours' },
                                                                                        min: 0,
                                                                                        max: getMaxY(chart)
                                                                                    }
                                                                                }
                                                                            }}
                                                                            width={360}
                                                                            height={260}
                                                                        />
                                                                    </div>
                                                                    {/* Project-level line chart below the bar chart */}
                                                                    {chart.lineData && chart.lineData.labels && chart.lineData.labels.length > 0 && (
                                                                        <div style={{
                                                                            width: '100%',
                                                                            height: 220,
                                                                            padding: '0 18px 18px 18px',
                                                                            boxSizing: 'border-box'
                                                                        }}>
                                                                            <Line
                                                                                data={{
                                                                                    ...chart.lineData,
                                                                                    datasets: chart.lineData.datasets.map(ds => ({
                                                                                        ...ds,
                                                                                        pointRadius: 1, // Make points smaller
                                                                                        pointHoverRadius: 4 // Slightly larger on hover
                                                                                    }))
                                                                                }}
                                                                                options={{
                                                                                    responsive: true,
                                                                                    maintainAspectRatio: false,
                                                                                    plugins: {
                                                                                        legend: {
                                                                                            position: 'top',
                                                                                            labels: {
                                                                                                usePointStyle: true,
                                                                                                pointStyle: 'rect',
                                                                                                font: { size: 12, family: 'Arial' },
                                                                                                boxWidth: 6,
                                                                                                boxHeight: 6,
                                                                                                padding: 4,
                                                                                                color: '#333'
                                                                                            }
                                                                                        },
                                                                                        tooltip: {
                                                                                            callbacks: {
                                                                                                label: function(context) {
                                                                                                    return `${context.dataset.label}: ${context.parsed.y}`;
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    },
                                                                                    elements: {
                                                                                        point: {
                                                                                            radius: 2,
                                                                                            hoverRadius: 4
                                                                                        }
                                                                                    },
                                                                                    scales: {
                                                                                        x: {
                                                                                            title: { display: false },
                                                                                            ticks: {
                                                                                                maxTicksLimit: 10,
                                                                                                autoSkip: true
                                                                                            }
                                                                                        },
                                                                                        y: {
                                                                                            title: { display: true, text: 'Hours' },
                                                                                            beginAtZero: true
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                width={360}
                                                                                height={180}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                    {activeTab === 'Resources' && (
                        <>
                            {/* Strategic Portfolio checkboxes and product line dropdowns in a card/frame */}
                            <div style={{
                                marginBottom: 18,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: '100%',
                            }}>
                                <div style={{
                                    background: '#f8f9fa',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '14px',
                                    padding: '18px 32px',
                                    display: 'flex',
                                    gap: '40px',
                                    alignItems: 'flex-end',
                                    boxShadow: '0 2px 8px rgba(25, 118, 210, 0.06)'
                                }}>
                                    {STRATEGIC_PORTFOLIO_FILTERS.map(opt => (
                                        <div
                                            key={opt.value}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                minWidth: 140,
                                                height: 80,
                                                justifyContent: 'flex-end'
                                            }}
                                        >
                                            <label style={{
                                                fontWeight: 'bold',
                                                fontSize: '16px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                marginBottom: 6,
                                                minHeight: 38
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPortfolio === opt.value}
                                                    onChange={() => {
                                                        setSelectedPortfolio(opt.value);
                                                        // Reset all dropdowns when a new checkbox is clicked
                                                        setPortfolioProductLines({});
                                                    }}
                                                    style={{
                                                        marginBottom: 6,
                                                        marginRight: 0,
                                                        transform: 'scale(1.2)'
                                                    }}
                                                />
                                                {opt.label}
                                            </label>
                                            {opt.value === 'All'
                                                ? <div style={{ height: 32, minWidth: 120 }}></div>
                                                : (
                                                    <select
                                                        style={{
                                                            minWidth: 120,
                                                            fontSize: '14px',
                                                            padding: '2px 6px',
                                                            borderRadius: 6,
                                                            border: '1px solid #bdbdbd',
                                                            background: '#fff'
                                                        }}
                                                        value={portfolioProductLines[opt.value] || ''}
                                                        onChange={e => handleProductLineChange(opt.value, e.target.value)}
                                                        disabled={getProductLinesForPortfolio(opt.value).length === 0}
                                                    >
                                                        <option value="">All</option>
                                                        {getProductLinesForPortfolio(opt.value).map(line => (
                                                            <option key={line} value={line}>{line}</option>
                                                        ))}
                                                    </select>
                                                )
                                            }
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pie Chart centered on top */}
                            <div style={{
                                width: '100%',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 32
                            }}>
                                <div style={{
                                    width: '520px',
                                    height: '520px',
                                    background: '#fff',
                                    boxShadow: '0 2px 12px rgba(25, 118, 210, 0.08)',
                                    padding: '18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    borderRadius: '18px',
                                    justifyContent: 'center'
                                }}>
                                    <h2 style={{
                                        textAlign: 'center',
                                        fontWeight: 'bold',
                                        marginBottom: '14px',
                                        color: 'black',
                                        letterSpacing: '1px',
                                        paddingTop: '20px',
                                        fontSize: '18px'
                                    }}>
                                        Project Type
                                    </h2>
                                    <div style={{ width: '100%', height: '340px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        {projectTypeData && (
                                            <Pie
                                                data={projectTypeData}
                                                options={{
                                                    ...pieOptions,
                                                    plugins: {
                                                        ...pieOptions.plugins,
                                                        legend: {
                                                            ...pieOptions.plugins.legend,
                                                            display: false // Hide default legend
                                                        }
                                                    }
                                                }}
                                                plugins={[pieLabelPlugin]}
                                                width={400}
                                                height={340}
                                            />
                                        )}
                                    </div>
                                    {/* Custom legend below and centered */}
                                    {projectTypeData && (
                                        <div style={{
                                            width: '100%',
                                            marginTop: '18px',
                                            display: 'flex',
                                            justifyContent: 'center'
                                        }}>
                                            <ul style={{
                                                listStyle: 'none',
                                                padding: 0,
                                                margin: 0,
                                                fontSize: '16px',
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '18px',
                                                justifyContent: 'center'
                                            }}>
                                                {projectTypeData.labels.map((label, i) => {
                                                    const value = projectTypeData.datasets[0].data[i];
                                                    const total = projectTypeData.datasets[0].data.reduce((a, b) => a + b, 0);
                                                    const percent = total ? ((value / total) * 100).toFixed(1) : 0;
                                                    return (
                                                        <li key={label} style={{ display: 'flex', alignItems: 'center' }}>
                                                            <span style={{
                                                                display: 'inline-block',
                                                                width: 16,
                                                                height: 16,
                                                                backgroundColor: projectTypeData.datasets[0].backgroundColor[i],
                                                                borderRadius: 4,
                                                                marginRight: 7,
                                                                border: '1px solid #ccc'
                                                            }}></span>
                                                            <span>{label}: <b>{value}</b> ({percent}%)</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Date controls and date range label */}
                            <div style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                marginBottom: 10
                            }}>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 18,
                                    marginBottom: 8
                                }}>
                                    <label style={{ fontWeight: 'bold', fontSize: 15 }}>Start Date:</label>
                                    <input
                                        type="date"
                                        value={inputStartDate}
                                        onChange={e => setInputStartDate(e.target.value)}
                                        style={{ fontSize: 15, padding: '4px 8px', borderRadius: 6, border: '1px solid #bdbdbd' }}
                                        max={inputEndDate}
                                    />
                                    <label style={{ fontWeight: 'bold', fontSize: 15 }}>End Date:</label>
                                    <input
                                        type="date"
                                        value={inputEndDate}
                                        onChange={e => setInputEndDate(e.target.value)}
                                        style={{ fontSize: 15, padding: '4px 8px', borderRadius: 6, border: '1px solid #bdbdbd' }}
                                        min={inputStartDate}
                                    />
                                    <button
                                        onClick={handleRefreshCharts}
                                        style={{
                                            marginLeft: 18,
                                            padding: '6px 18px',
                                            fontSize: 15,
                                            fontWeight: 'bold',
                                            borderRadius: 6,
                                            border: '1px solid #1976d2',
                                            background: '#1976d2',
                                            color: '#fff',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Refresh Charts
                                    </button>
                                </div>
                                {dateError && (
                                    <div style={{ color: 'red', fontSize: 14, marginBottom: 6 }}>{dateError}</div>
                                )}
                                <div style={{
                                    fontWeight: 'bold',
                                    fontSize: 16,
                                    textAlign: 'center',
                                    marginBottom: 18
                                }}>
                                    {formatDateRange(chartStartDate, chartEndDate)}
                                </div>
                            </div>

                            {/* Only show Capacity/Allocation Bar Chart and Portfolio Trend Line Chart in Resources tab */}
                            <div style={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'flex-start',
                                gap: '60px',
                                marginBottom: 40
                            }}>
                                <div style={{
                                    width: '400px',
                                    height: '520px',
                                    background: '#fff',
                                    boxShadow: '0 2px 12px rgba(25, 118, 210, 0.08)',
                                    padding: '18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    borderRadius: '18px',
                                    justifyContent: 'center'
                                }}>
                                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '4px' }}>
                                        Capacity, Planned and Actual Allocation
                                    </div>
                                    <div style={{
                                        textAlign: 'center',
                                        fontWeight: 'normal',
                                        fontSize: '15px',
                                        color: '#444',
                                        marginBottom: '8px'
                                    }}>
                                        {selectedPortfolio !== 'All' && selectedProductLine
                                            ? `${selectedPortfolio} - ${selectedProductLine}`
                                            : selectedPortfolio !== 'All'
                                                ? selectedPortfolio
                                                : ''}
                                    </div>
                                    <div style={{ textAlign: 'center', fontSize: '14px', marginBottom: '18px', color: '#555' }}>
                                        {barDateRange && <span>({barDateRange})</span>}
                                    </div>
                                    <div style={{ width: '100%', height: '340px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        {barData && (
                                            <Bar
                                                data={{
                                                    labels: [''],
                                                    datasets: getGroupedBarDatasets(
                                                        barData.capacity,
                                                        barData.planned,
                                                        barData.actual
                                                    )
                                                }}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    barPercentage: 0.8,
                                                    categoryPercentage: 0.6,
                                                    plugins: {
                                                        legend: {
                                                            position: 'top',
                                                            labels: {
                                                                usePointStyle: true,
                                                                pointStyle: 'rect',
                                                                font: { size: 12, family: 'Arial' },
                                                                boxWidth : 6,
                                                                boxHeight: 6,
                                                                padding: 4,
                                                                color: '#333'
                                                            }
                                                        },
                                                        tooltip: {
                                                            callbacks: {
                                                                label: function(context) {
                                                                    return `${context.dataset.label}: ${context.parsed.y}`;
                                                                }
                                                            }
                                                        }
                                                    },
                                                    scales: {
                                                        x: {
                                                            stacked: false,
                                                            title: { display: false }
                                                        },
                                                        y: {
                                                            stacked: false,
                                                            title: { display: true, text: 'Hours' }
                                                        }
                                                    }
                                                }}
                                                width={320}
                                                height={340}
                                            />
                                        )}
                                        {!barData && (
                                            <div style={{ color: '#888', textAlign: 'center', width: '100%' }}>
                                                {selectedPortfolio === 'All'
                                                    ? 'Select a Strategic Portfolio to view Capacity/Allocation'
                                                    : 'No data available'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Portfolio Trend Line Chart */}
                                <div style={{
                                    width: '650px',
                                    height: '520px',
                                    background: '#fff',
                                    boxShadow: '0 2px 12px rgba(25, 118, 210, 0.08)',
                                    padding: '18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    borderRadius: '18px',
                                    justifyContent: 'center'
                                }}>
                                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', marginBottom: '4px' }}>
                                        {selectedProductLine
                                            ? <>
                                                Capacity Allocation Trend<br />
                                                <span style={{ fontWeight: 'normal', fontSize: '15px', color: '#444' }}>
                                                    {selectedPortfolio} - {selectedProductLine}
                                                </span>
                                              </>
                                            : <>
                                                Capacity Allocation Trend
                                                <br />
                                                <span style={{ fontWeight: 'normal', fontSize: '15px', color: '#444' }}>
                                                    {selectedPortfolio !== 'All' ? selectedPortfolio : ''}
                                                </span>
                                              </>
                                    }
                                    </div>
                                    <div style={{ width: '100%', height: '340px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        {portfolioTrendData ? (
                                            <Line
                                                data={portfolioTrendData}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    plugins: {
                                                        legend: {
                                                            position: 'top',
                                                            labels: {
                                                                usePointStyle: true,
                                                                pointStyle: 'rect',
                                                                font: { size: 12, family: 'Arial' },
                                                                boxWidth : 6,
                                                                boxHeight: 6,
                                                                padding: 4,
                                                                color: '#333'
                                                            }
                                                        },
                                                        tooltip: {
                                                            callbacks: {
                                                                label: function(context) {
                                                                    return `${context.dataset.label}: ${context.parsed.y}`;
                                                                }
                                                            }
                                                        }
                                                    },
                                                    scales: {
                                                        x: {
                                                            title: { display: false },
                                                            ticks: {
                                                                maxTicksLimit: 12,
                                                                autoSkip: false
                                                            }
                                                        },
                                                        y: {
                                                            title: { display: true, text: 'Hours' },
                                                            beginAtZero: true
                                                        }
                                                    }
                                                }}
                                                width={600}
                                                height={340}
                                            />
                                        ) : (
                                            <div style={{ color: '#888', textAlign: 'center', width: '100%' }}>
                                                {selectedPortfolio === 'All'
                                                    ? 'Select a Strategic Portfolio to view Trend'
                                                    : 'Portfolio API endpoint not available. Contact your administrator.'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;