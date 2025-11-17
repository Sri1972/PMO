import React from 'react';
import { BrowserRouter as Router, Link, Route, Routes, Navigate } from 'react-router-dom';
import ResourceAllocationPlanned from './components/ResourceAllocationPlanned';
import ResourceAllocationPlannedEditor from './components/ResourceAllocationPlannedEditor';
import ResourceAllocationActual from './components/ResourceAllocationActual';
import Timesheet from './components/Timesheet';
import Resources from './components/Resources';
import Projects from './components/Projects';
import ProjectEstimation from './components/ProjectEstimation';
import Dashboard from './components/Dashboard';
import './styles/App.css'; // Import the CSS file
import logo from './images/logo-mobility.svg'; // Import the logo image

const App = () => {
    return (
        <Router>
            <div className="black-strip"></div>
            <header className="header">
                <img src={logo} alt="Logo" className="logo" />
                <nav className="nav-tabs">
                    <ul>
                        <li>
                            <Link to="/dashboard">Dashboard</Link>
                        </li>
                        <li className="dropdown">
                            <span className="dropdown-toggle">Projects</span>
                            <ul className="dropdown-menu">
                                <li>
                                    <Link to="/projects">Details</Link>
                                </li>
                                <li>
                                    <Link to="/project-estimation">Estimation</Link>
                                </li>
                            </ul>
                        </li>
                        <li>
                            <Link to="/resources">Resources</Link>
                        </li>
                        <li className="dropdown">
                            <span className="dropdown-toggle">Allocations</span>
                            <ul className="dropdown-menu">
                                <li>
                                    <Link to="/resource-allocation-planned">Planned</Link>
                                </li>
                                <li>
                                    <Link to="/resource-allocation-actual">Actual</Link>
                                </li>
                                <li>
                                    <Link to="/timesheet">Timesheet</Link>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </nav>
                <h1>PMO Portal</h1>
            </header>
            <div className="container">
                <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/resource-allocation-planned" element={<ResourceAllocationPlanned />} />
                    <Route path="/resource-allocation-planned-editor" element={<ResourceAllocationPlannedEditor />} />
                    <Route path="/resource-allocation-actual" element={<ResourceAllocationActual />} />
                    <Route path="/timesheet" element={<Timesheet />} />
                    <Route path="/resources" element={<Resources />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/project-estimation" element={<ProjectEstimation />} />
                    <Route path="/" element={<Navigate to="/dashboard" />} /> {/* Redirect to Dashboard */}
                </Routes>
            </div>
        </Router>
    );
};

export default App;
