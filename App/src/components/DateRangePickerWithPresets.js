import React, { useState } from 'react';
import '../styles/DateRangePickerWithPresets.css';

const DateRangePickerWithPresets = ({ startDate, endDate, onChange, onClose }) => {
    const [localStartDate, setLocalStartDate] = useState(startDate || '');
    const [localEndDate, setLocalEndDate] = useState(endDate || '');

    const applyPreset = (preset) => {
        const today = new Date();
        let start, end;

        switch (preset) {
            case 'thisMonth':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'nextMonth':
                start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
                break;
            case 'thisQuarter':
                const currentQuarter = Math.floor(today.getMonth() / 3);
                start = new Date(today.getFullYear(), currentQuarter * 3, 1);
                end = new Date(today.getFullYear(), currentQuarter * 3 + 3, 0);
                break;
            case 'nextQuarter':
                const nextQuarter = Math.floor(today.getMonth() / 3) + 1;
                start = new Date(today.getFullYear(), nextQuarter * 3, 1);
                end = new Date(today.getFullYear(), nextQuarter * 3 + 3, 0);
                break;
            case 'thisYear':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                break;
            default:
                return;
        }

        const formattedStart = start.toISOString().split('T')[0];
        const formattedEnd = end.toISOString().split('T')[0];

        setLocalStartDate(formattedStart);
        setLocalEndDate(formattedEnd);
    };

    const handleApply = () => {
        if (localStartDate && localEndDate) {
            onChange(localStartDate, localEndDate);
            onClose();
        }
    };

    return (
        <div className="date-range-picker-modal">
            <div className="date-range-picker-overlay" onClick={onClose}></div>
            <div className="date-range-picker-content">
                <div className="date-range-header">
                    <h6>Select Date Range</h6>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="date-range-body">
                    <div className="presets-section">
                        <h6>Quick Presets</h6>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('thisMonth')}>
                            This Month
                        </button>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('nextMonth')}>
                            Next Month
                        </button>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('thisQuarter')}>
                            This Quarter
                        </button>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('nextQuarter')}>
                            Next Quarter
                        </button>
                        <button type="button" className="preset-btn" onClick={() => applyPreset('thisYear')}>
                            This Year
                        </button>
                    </div>

                    <div className="date-inputs-section">
                        <div className="date-input-group">
                            <label>Start Date</label>
                            <input
                                type="date"
                                value={localStartDate}
                                onChange={(e) => setLocalStartDate(e.target.value)}
                            />
                        </div>
                        <div className="date-input-group">
                            <label>End Date</label>
                            <input
                                type="date"
                                value={localEndDate}
                                onChange={(e) => setLocalEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="date-range-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleApply}>
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DateRangePickerWithPresets;