import React from 'react';
import { ShieldAlert, Database, HelpCircle, Terminal, Globe } from 'lucide-react';

export const SupabaseConfigRequired: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-6 font-sans text-text-primary select-none">
      <div className="bg-bg-card w-full max-w-[580px] rounded-[16px] shadow-popup border border-border p-10 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0">
            <ShieldAlert className="w-9 h-9 text-primary" />
          </div>
          <h1 className="text-[26px] font-bold tracking-[-0.5px]">
            Supabase Connection Required
          </h1>
          <p className="text-[14px] text-text-muted max-w-md">
            RestroFlow is now configured as a cloud-based POS. To launch the application, you need to connect your Supabase database.
          </p>
        </div>

        <div className="border-b border-border my-1" />

        {/* Steps List */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[15px] font-bold text-text-primary uppercase tracking-[0.5px]">
            Configuration Instructions
          </h2>

          {/* Local Step */}
          <div className="flex gap-4 items-start p-4 bg-bg-page/40 rounded-card border border-border/80">
            <Terminal className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold text-text-primary">
                Local Development (.env)
              </span>
              <p className="text-[13px] text-text-muted leading-relaxed select-text">
                Create a file named <code className="bg-bg-page px-1.5 py-0.5 rounded font-mono text-[12px] text-primary border border-border">.env</code> in your project root and paste your credentials:
              </p>
              <pre className="bg-bg-page p-3 rounded-btn font-mono text-[12px] text-text-primary border border-border select-text overflow-x-auto mt-1.5 whitespace-pre">
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anonymous-anon-key`}
              </pre>
            </div>
          </div>

          {/* Production Step */}
          <div className="flex gap-4 items-start p-4 bg-bg-page/40 rounded-card border border-border/80">
            <Globe className="w-5 h-5 text-[#A52A2A] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold text-text-primary">
                Vercel / Cloud Deployment
              </span>
              <p className="text-[13px] text-text-muted leading-relaxed">
                Add the environment variables in your Vercel project settings:
              </p>
              <ul className="list-disc pl-5 mt-1.5 text-[13px] text-text-muted flex flex-col gap-1">
                <li>Go to Vercel Settings → Environment Variables.</li>
                <li>Add <code className="font-mono text-[12px] text-primary">VITE_SUPABASE_URL</code></li>
                <li>Add <code className="font-mono text-[12px] text-primary">VITE_SUPABASE_ANON_KEY</code></li>
                <li>Redeploy your project for the changes to take effect.</li>
              </ul>
            </div>
          </div>

          {/* Database Setup Info */}
          <div className="flex gap-4 items-start p-4 bg-bg-page/40 rounded-card border border-border/80">
            <Database className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold text-text-primary">
                Supabase SQL Setup
              </span>
              <p className="text-[13px] text-text-muted leading-relaxed select-text">
                Don't forget to run the SQL tables creation script. Copy the contents of the file <code className="font-mono text-[12px] text-primary">supabase_schema.sql</code> and execute it in your Supabase SQL Editor.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4 flex justify-center">
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-primary hover:text-primary-dark font-semibold flex items-center gap-1 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Go to Supabase Dashboard
          </a>
        </div>
      </div>
    </div>
  );
};
