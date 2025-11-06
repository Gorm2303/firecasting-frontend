import React, { useState } from 'react';
import { YearlySummary } from '../../models/YearlySummary';

interface InputFormProps {
    onSimulationComplete: (stats: YearlySummary[]) => void;
}
const AdvancedInputForm: React.FC<InputFormProps> = ({  }) => {
    const [startDate, setStartDate] = useState('2025-01-01');

    return (
        <div>
            <form>
                <div style={{ marginBottom: '1rem' }}>
                    <label>
                        Start Date:
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            style={{ marginLeft: '0.5rem' }}
                        />
                    </label>
                </div>
            </form>
        </div>
    );
};

export default AdvancedInputForm;
    