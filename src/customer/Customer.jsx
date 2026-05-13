import { Outlet } from 'react-router-dom';
import TabBar from './components/TabBar';

const Customer = () => {
  return (
    <div className="flex h-dvh w-full flex-col bg-gray-50">
      <main
        id="customer-scroll-root"
        className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"
      >
        <Outlet />
      </main>
      {/* Mobile Bottom Tab Navigation - hidden on desktop */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 w-full lg:hidden">
        <TabBar />
      </nav>
    </div>
  );
};

export default Customer;
