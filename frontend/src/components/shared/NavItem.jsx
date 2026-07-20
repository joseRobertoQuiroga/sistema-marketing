import React from 'react'

export default function NavItem({ icon, label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center px-6 py-3 w-full cursor-pointer transition-all group
      ${active ? 'bg-indigo-500/10 text-indigo-400 border-r-2 border-indigo-500 active-nav-glow' : 'text-slate-500 hover:bg-slate-800/80 hover:text-indigo-300'}
    `}>
      <span className="mr-4">{React.cloneElement(icon, { size: 18 })}</span>
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
    </div>
  )
}
