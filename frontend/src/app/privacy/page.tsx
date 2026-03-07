import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-white/10">
      
      {/* MINIMAL HEADER */}

      {/* CONTENT DOCUMENT */}
      <main className="max-w-3xl mx-auto px-6 py-24">
        <div className="mb-16">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Effective Date: March 2026 | Document Ref: OP-PRV-01</p>
        </div>

        <div className="space-y-12 text-sm md:text-base font-light leading-relaxed">
          
          <section>
            <h2 className="text-white font-medium text-lg mb-4 flex items-center gap-3">
              <span className="text-slate-600 font-mono text-sm">1.0</span> Strategic Data Collection
            </h2>
            <p className="text-slate-400 mb-4">To provide high-resolution analytical services, the platform limits data collection to strictly necessary operational parameters:</p>
            <ul className="space-y-3 border-l border-white/10 pl-6 ml-2 text-slate-400">
              <li><strong className="text-white font-medium">Authentication Data:</strong> Cryptographic tokens and basic identity markers provided by third-party authentication services to verify user sessions.</li>
              <li><strong className="text-white font-medium">Geospatial Telemetry:</strong> The specific geographic coordinates, mitigation variables, and timeframes queried by the user.</li>
              <li><strong className="text-white font-medium">System Diagnostics:</strong> Aggregated performance metrics regarding simulation compute times and user interaction patterns.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-medium text-lg mb-4 flex items-center gap-3">
              <span className="text-slate-600 font-mono text-sm">2.0</span> Utilization of Information
            </h2>
            <p className="text-slate-400">
              Data ingestion is utilized exclusively for platform optimization and service delivery. Query telemetry is processed to allocate computational resources effectively and to train the predictive models for higher accuracy. The platform does not profile individual user ideologies or personal behaviors; it measures macro-environmental risks.
            </p>
          </section>

          <section>
            <h2 className="text-white font-medium text-lg mb-4 flex items-center gap-3">
              <span className="text-slate-600 font-mono text-sm">3.0</span> Confidentiality and Non-Monetization
            </h2>
            <p className="text-slate-400 mb-4">The provider recognizes the sensitive nature of spatial risk inquiries conducted by institutional investors, sovereign entities, and corporate strategists.</p>
            <ul className="space-y-3 border-l border-white/10 pl-6 ml-2 text-slate-400">
              <li>The provider strictly prohibits the sale, leasing, or brokering of user query histories to third-party marketing entities or external data brokers.</li>
              <li>Specific geographical areas of interest researched by the user remain confidential and are not broadcasted or shared with competing entities.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-medium text-lg mb-4 flex items-center gap-3">
              <span className="text-slate-600 font-mono text-sm">4.0</span> External Disclosures
            </h2>
            <p className="text-slate-400 mb-4">Information is shared externally only under the following strict conditions:</p>
            <ul className="space-y-3 border-l border-white/10 pl-6 ml-2 text-slate-400">
              <li>With vetted cloud computing and infrastructure providers strictly for the purpose of hosting the analytical engine and processing complex mathematical simulations.</li>
              <li>When mandated by binding legal processes or lawful requests from recognized jurisdictional authorities.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-medium text-lg mb-4 flex items-center gap-3">
              <span className="text-slate-600 font-mono text-sm">5.0</span> Security Architecture
            </h2>
            <p className="text-slate-400">
              The platform employs industry-standard cryptographic protocols to secure data in transit and at rest. While the provider deploys enterprise-grade security architecture to protect session tokens and query histories, the user acknowledges that no web-connected computational system can guarantee absolute invulnerability against sophisticated external intrusions.
            </p>
          </section>

          <section>
            <h2 className="text-white font-medium text-lg mb-4 flex items-center gap-3">
              <span className="text-slate-600 font-mono text-sm">6.0</span> User Sovereignty
            </h2>
            <p className="text-slate-400">
              Users maintain the right to terminate their sessions, revoke authentication tokens via their primary identity providers, and request the deletion of their distinct account profiles from the provider’s active databases, subject to standard technical retention cycles necessary for system backups and legal compliance.
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}