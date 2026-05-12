'use client';

import { UserButton } from '@clerk/nextjs';
import { Bell, Settings, Search } from 'lucide-react';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = 'Overview' }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[#0B2447]">{title}</h2>
      </div>

      {/* Search + Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search fleet or bookings..."
            className="pl-9 pr-4 py-2 w-64 rounded-lg border border-slate-200 bg-slate-50/50 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/20 focus:border-[#0B3D91] transition-all"
          />
        </div>

        {/* Notification */}
        <button className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 hover:text-[#0B2447]">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Settings */}
        <button className="p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 hover:text-[#0B2447]">
          <Settings className="w-5 h-5" />
        </button>

        {/* User Menu / Avatar */}
        <div className="pl-2 border-l border-slate-200 flex items-center">
          <UserButton 
            appearance={{
              elements: {
                userButtonAvatarBox: 'w-9 h-9 border-2 border-slate-100'
              }
            }}
          />
        </div>
      </div>
    </header>
  );
}
