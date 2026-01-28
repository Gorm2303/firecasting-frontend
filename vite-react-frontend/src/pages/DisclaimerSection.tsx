import React from 'react';

const DisclaimerSection: React.FC = () => {
  return (
    <details className="info-section" open>
      <summary className="info-section-summary">
        <h2 tabIndex={-1}>Disclaimers</h2>
      </summary>

      <div className="info-section-body" style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>
        <h3 style={{ marginTop: 0 }}>“Use at Your Own Risk” Disclaimer</h3>
        <p>
          The information and tools provided through Firecasting are offered for general educational and illustrative purposes
          only. You use this platform entirely at your own risk. While every effort is made to ensure the reliability of
          calculations and simulations, no guarantee is made regarding their accuracy, completeness, or suitability for any
          specific purpose.
        </p>

        <h3>“Errors and Omissions” Disclaimer</h3>
        <p>
          Despite ongoing efforts to maintain accurate and up-to-date information, Firecasting assumes no responsibility for
          errors or omissions in the content or outputs. All simulations are provided “as is” without any warranties, express
          or implied. Users should verify results and consult independent sources before making decisions based on them.
        </p>

        <h3>“Investment” Disclaimer</h3>
        <p>
          Nothing presented on this website constitutes financial, investment, tax, or legal advice. Firecasting is not a
          financial advisor, and no part of this site should be interpreted as a recommendation to buy, sell, or hold any
          financial instrument. Investment decisions involve risk, including possible loss of principal. Always perform your
          own due diligence or consult a licensed professional before acting on any information found here.
        </p>

        <p style={{ fontStyle: 'italic', opacity: 0.75, marginTop: 16 }}>
          By using this site, you acknowledge that you have read, understood, and agree to these disclaimers.
        </p>
      </div>
    </details>
  );
};

export default DisclaimerSection;
