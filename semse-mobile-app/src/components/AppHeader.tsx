import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Bell, MoreVertical, Menu } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  showMenu?: boolean;
  showSearch?: boolean;
  showNotifications?: boolean;
  showMore?: boolean;
  onMenuClick?: () => void;
  transparent?: boolean;
}

export default function AppHeader({
  title,
  showBack = false,
  showMenu = false,
  showSearch = false,
  showNotifications = false,
  showMore = false,
  onMenuClick,
  transparent = false,
}: AppHeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={`sticky top-0 z-40 flex items-center justify-between px-4 h-14 ${
        transparent ? 'bg-transparent' : 'bg-white'
      } border-b border-gray-100`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full active:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#1A2B3C]" />
          </button>
        )}
        {showMenu && (
          <button
            onClick={onMenuClick}
            className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full active:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-[#1A2B3C]" />
          </button>
        )}
        <h1 className="text-base font-semibold text-[#1A2B3C] truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        {showSearch && (
          <button className="flex items-center justify-center w-10 h-10 rounded-full active:bg-gray-100 transition-colors">
            <Search className="w-5 h-5 text-[#5A6B7D]" />
          </button>
        )}
        {showNotifications && (
          <button className="flex items-center justify-center w-10 h-10 rounded-full active:bg-gray-100 transition-colors relative">
            <Bell className="w-5 h-5 text-[#5A6B7D]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        )}
        {showMore && (
          <button className="flex items-center justify-center w-10 h-10 rounded-full active:bg-gray-100 transition-colors">
            <MoreVertical className="w-5 h-5 text-[#5A6B7D]" />
          </button>
        )}
      </div>
    </header>
  );
}
