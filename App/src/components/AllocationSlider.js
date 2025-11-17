import React, { useState, useEffect } from 'react';
import '../styles/AllocationSlider.css';

const AllocationSlider = ({ allocationPct, allocationHrs, onChange, resourceCapacity = 40 }) => {
    const [mode, setMode] = useState('percentage'); // 'percentage' or 'hours'
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (allocationPct) {
            setMode('percentage');
            setValue(parseFloat(allocationPct) || 0);
        } else if (allocationHrs) {
            setMode('hours');
            setValue(parseFloat(allocationHrs) || 0);
        }
    }, [allocationPct, allocationHrs]);

    const handleModeToggle = () => {
        const newMode = mode === 'percentage' ? 'hours' : 'percentage';
        setMode(newMode);

        // Convert value when switching modes
        if (newMode === 'hours') {
            const hours = (value / 100) * resourceCapacity;
            setValue(hours);
            onChange({ allocationPct: null, allocationHrs: hours });
        } else {
            const percentage = (value / resourceCapacity) * 100;
            setValue(percentage);
            onChange({ allocationPct: percentage, allocationHrs: null });
        }
    };

    const handleSliderChange = (e) => {
        const newValue = parseFloat(e.target.value);
        setValue(newValue);

        if (mode === 'percentage') {
            onChange({ allocationPct: newValue, allocationHrs: null });
        } else {
            onChange({ allocationPct: null, allocationHrs: newValue });
        }
    };

    const handleInputChange = (e) => {
        const newValue = parseFloat(e.target.value) || 0;
        setValue(newValue);

        if (mode === 'percentage') {
            onChange({ allocationPct: newValue, allocationHrs: null });
        } else {
            onChange({ allocationPct: null, allocationHrs: newValue });
        }
    };

    const maxValue = mode === 'percentage' ? 100 : resourceCapacity;
    const step = mode === 'percentage' ? 1 : 0.5;

    return (
        <div className="allocation-slider-container">
            <div className="allocation-slider-header">
                <label>Allocation</label>
                <button
                    type="button"
                    className="mode-toggle-btn"
                    onClick={handleModeToggle}
                    title={`Switch to ${mode === 'percentage' ? 'hours' : 'percentage'} mode`}
                >
                    {mode === 'percentage' ? '% → hrs' : 'hrs → %'}
                </button>
            </div>

            <div className="slider-row">
                <input
                    type="range"
                    min="0"
                    max={maxValue}
                    step={step}
                    value={value}
                    onChange={handleSliderChange}
                    className="allocation-slider"
                />
                <div className="value-input-container">
                    <input
                        type="number"
                        min="0"
                        max={maxValue}
                        step={step}
                        value={value}
                        onChange={handleInputChange}
                        className="value-input"
                    />
                    <span className="value-unit">{mode === 'percentage' ? '%' : 'hrs'}</span>
                </div>
            </div>

            {mode === 'percentage' && (
                <div className="conversion-hint">
                    ≈ {((value / 100) * resourceCapacity).toFixed(1)} hours/week
                </div>
            )}
            {mode === 'hours' && (
                <div className="conversion-hint">
                    ≈ {((value / resourceCapacity) * 100).toFixed(1)}% allocation
                </div>
            )}
        </div>
    );
};

export default AllocationSlider;