import React from 'react';

export default function ResourceTooltip(props) {
    const { value } = props;

    return (
        <div style={{ whiteSpace: 'pre-line', padding: '5px', backgroundColor: '#f9f9f9', border: '1px solid #ccc', borderRadius: '4px' }}>
            {value || 'No resource details available'}
        </div>
    );
}
