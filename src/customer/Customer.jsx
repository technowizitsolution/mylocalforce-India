import { Outlet } from "react-router-dom"
import TabBar from "./components/TabBar"

const Customer = () => {
    return (
        <div className="flex flex-col h-dvh w-full bg-gray-50">
            <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
                <Outlet />
            </main>
            {/* Mobile Bottom Tab Navigation — hidden on desktop */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 w-full z-40">
                <TabBar />
            </nav>
        </div>
    )
}

export default Customer