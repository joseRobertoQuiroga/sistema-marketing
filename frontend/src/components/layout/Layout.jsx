import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-[#051424] text-[#d4e4fa] font-sans">
      <Header />
      <div className="flex flex-1 pt-16 overflow-hidden">
        <Sidebar />
        <main className="ml-64 flex-1 flex h-full overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
