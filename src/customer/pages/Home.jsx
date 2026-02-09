import React, { useState } from 'react'
import { ChevronDown, Bell, Search, ChevronRight } from 'react-feather'

const Home = () => {
  const [selectedRole, setSelectedRole] = useState('Customer')

  const services = [
    {
      id: 1,
      name: 'Cleaning Services',
      image: '🧹',
      color: 'bg-blue-50'
    },
    {
      id: 2,
      name: 'Glow Massage',
      image: '💆',
      color: 'bg-purple-50'
    },
    {
      id: 3,
      name: 'Glow Beauty',
      image: '✨',
      color: 'bg-pink-50'
    },
    {
      id: 4,
      name: 'Glow Hair',
      image: '💇',
      color: 'bg-yellow-50'
    },
  ]

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex justify-between items-center shadow-sm">
        {/* Role Selector */}
        <div className="flex items-center gap-2 bg-blue-100 rounded-full px-4 py-2">
          <span className="text-blue-600">👤</span>
          <button className="flex items-center gap-1 text-blue-600 font-medium">
            {selectedRole}
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Notification Bell */}
        <button className="bg-purple-100 p-3 rounded-lg">
          <Bell size={24} className="text-purple-600" />
        </button>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Greeting Section */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Hey Sunny</h1>
          <p className="text-gray-500 text-lg">Find the perfect service at your home.</p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search for services..."
            className="w-full px-4 py-3 pr-12 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 bg-purple-500 p-2 rounded-lg">
            <Search size={20} className="text-white" />
          </button>
        </div>

        {/* Banner Image */}
        <div className="relative rounded-2xl overflow-hidden h-48">
          <img
            src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500&h=300&fit=crop"
            alt="Featured Service"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20"></div>
          <button className="absolute bottom-4 right-4 bg-white/80 p-3 rounded-lg hover:bg-white">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Our Services Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Services</h2>
          
          {/* Services Grid */}
          <div className="grid grid-cols-2 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className={`${service.color} rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow`}
              >
                <div className="text-5xl mb-3">{service.image}</div>
                <h3 className="text-gray-900 font-bold text-sm">{service.name}</h3>
              </div>
            ))}
          </div>
        </div>

        {/* Extra spacing for tab bar */}
        <div className="h-8"></div>
      </div>
    </div>
  )
}

export default Home