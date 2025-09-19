import React, { useState, useRef, useEffect } from 'react';
import { FiMoreVertical, FiTrash2, FiEdit, FiEye, FiEyeOff } from 'react-icons/fi';

interface LoraMenuProps {
  lora: { id: string; name: string; isPublic: boolean; status: string; };
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onToggleVisibility: (id: string, isPublic: boolean) => void;
}

const LoraMenu: React.FC<LoraMenuProps> = ({ lora, onDelete, onRename, onToggleVisibility }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRename = () => {
    const newName = prompt('Enter new name for LoRA:', lora.name);
    if (newName && newName.trim() !== '') {
      onRename(lora.id, newName.trim());
    }
    setIsOpen(false);
  };

  const handleToggleVisibility = () => {
    const confirmationText = lora.isPublic ? 'Are you sure you want to make this LoRA private?' : 'Are you sure you want to make this LoRA public?';
    if (window.confirm(confirmationText)) {
      onToggleVisibility(lora.id, !lora.isPublic);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full hover:bg-gray-200">
        <FiMoreVertical className="h-5 w-5" />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <button onClick={handleRename} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <FiEdit className="mr-3" /> Rename
            </button>
            {(lora.status === 'ready' || lora.status === 'active' || lora.isPublic) && (
              <button onClick={handleToggleVisibility} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                {lora.isPublic ? <FiEyeOff className="mr-3" /> : <FiEye className="mr-3" />} {lora.isPublic ? 'Make Private' : 'Make Public'}
              </button>
            )}
            <button onClick={() => { onDelete(lora.id); setIsOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
              <FiTrash2 className="mr-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoraMenu;