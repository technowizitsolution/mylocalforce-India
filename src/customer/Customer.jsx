import { Outlet } from "react-router-dom"
import TabBar from "./components/TabBar"

const Customer = () => {
    return (
        <div className="flex flex-col h-screen w-screen bg-gray-50">
            <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-0">
                <Outlet />
            </main>
            {/* Mobile Bottom Tab Navigation */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 w-full">
                <TabBar />
            </nav>
        </div>
    )
}

export default Customer