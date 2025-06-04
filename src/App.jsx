import './App.css'
import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import { 
    ChevronDown, Moon, Sun, Home, FileText, ShoppingCart, Package, Users, Settings, 
    Briefcase, DollarSign, BarChart2, Layers, Building, Image as ImageIcon, Eye, 
    Printer, X, PlusCircle, Edit2, Trash2, AlertTriangle, FilePlus as LucideFilePlus, 
    ClipboardList, LogIn, LogOut, UserCircle 
} from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    // signInAnonymously, // Removed: Unused
    signInWithCustomToken 
} from 'firebase/auth';
import { 
    getFirestore, collection, doc, addDoc, onSnapshot, 
    writeBatch, deleteDoc, setDoc, query, serverTimestamp, // Removed getDocs, updateDoc, where: Unused
    enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED, 
    setLogLevel, Timestamp 
} from 'firebase/firestore'; 

// Icon alias for clarity
const FilePlus = LucideFilePlus;

// --- Default Initial Data ---
const defaultCompanyInfo = {
  name: 'Mon Entreprise',
  logoUrl: '',
  address: '123 Rue Exemple, Tunis',
  phone: '+216 12 345 678',
  email: 'contact@monentreprise.com',
  vatNumber: 'TVA1234567',
  currency: 'TND',
  defaultTaxRate: 0.19, 
  lowStockThreshold: 10,
};

const invoiceStatuses = ['Payée', 'En attente', 'En retard', 'Annulée'];
const quoteStatuses = ['Brouillon', 'Envoyé', 'Accepté', 'Rejeté', 'Facturé', 'Annulé'];

// --- Helper Functions ---
const formatCurrency = (amount, currency = 'TND') => {
  return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: currency }).format(amount);
};
const formatDateForInput = (date) => {
    if (!date) return '';
    if (date instanceof Timestamp) {
        return date.toDate().toISOString().split('T')[0];
    }
    if (typeof date === 'string' && date.includes('T')) { 
        return date.split('T')[0];
    }
     if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) { 
        return date;
    }
    if (date instanceof Date) {
        return date.toISOString().split('T')[0];
    }
    console.warn("formatDateForInput received an unexpected date format:", date);
    return date.toString(); 
};


// --- UI Components ---
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    let sizeClass = 'max-w-md';
    if (size === 'lg') sizeClass = 'max-w-lg';
    if (size === 'xl') sizeClass = 'max-w-xl';
    if (size === '2xl') sizeClass = 'max-w-2xl';
    if (size === '4xl') sizeClass = 'max-w-4xl'; 
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full ${sizeClass} flex flex-col max-h-[90vh]`}>
                <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><X size={24} /></button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
            <div className="space-y-5">
                <div className="flex items-start space-x-3">
                    <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-800/30 sm:mx-0 sm:h-10 sm:w-10`}>
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                    </div>
                    <div className="mt-0 text-center sm:text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">{title}</h3>
                        <div className="mt-2"><p className="text-sm text-gray-500 dark:text-gray-300">{message}</p></div>
                    </div>
                </div>
                <div className={`mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3 bg-gray-50 dark:bg-gray-800 px-4 py-3 -m-6 -mb-6 rounded-b-xl`}>
                    <button type="button" className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 sm:ml-3 sm:w-auto sm:text-sm`} onClick={() => { onConfirm(); onClose(); }}>Confirmer</button>
                    <button type="button" className={`mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 sm:mt-0 sm:w-auto sm:text-sm`} onClick={onClose}>Annuler</button>
                </div>
            </div>
        </Modal>
    );
};

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload; 
    return (
      <div className={`bg-white dark:bg-gray-700 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600`}>
        <p className="label text-sm text-gray-700 dark:text-gray-300">{`${label}`}</p>
        <p className="intro text-blue-600 dark:text-blue-400 font-semibold">{`Chiffre d'affaires: ${formatCurrency(data.sales, currency)}`}</p>
        {data.invoiceCount !== undefined && (<p className="text-xs text-gray-500 dark:text-gray-400">{`Factures payées: ${data.invoiceCount}`}</p>)}
      </div>
    );
  }
  return null;
};

const PaymentStatsChart = ({ data, currency }) => {
  if (!data || data.length === 0) return <p className="text-center text-gray-500 dark:text-gray-400 py-8">Aucune donnée de paiement à afficher.</p>;
  return (
    <ResponsiveContainer width="100%" height={400}> 
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
        <XAxis dataKey="name" tick={{ fill: 'rgb(107 114 128)', fontSize: 12 }} className="dark:fill-gray-400" />
        <YAxis tickFormatter={(value) => formatCurrency(value, currency).replace(currency, '').trim()} tick={{ fill: 'rgb(107 114 128)', fontSize: 12 }} className="dark:fill-gray-400" />
        <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: 'rgba(100, 100, 100, 0.1)' }}/>
        <Bar dataKey="sales" name="Chiffre d'affaires" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

// --- FORM & PREVIEW MODALS (Defined before Page Components that use them) ---

const CustomerFormModal = ({ isOpen, onClose, onSave, customer }) => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
    useEffect(() => { if (customer) setFormData(customer); else setFormData({ name: '', email: '', phone: '', address: '' });}, [customer, isOpen]);
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value }));};
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData);};
    return (<Modal isOpen={isOpen} onClose={onClose} title={customer ? "Modifier Client" : "Ajouter Client"} size="lg"><form onSubmit={handleSubmit} className="space-y-4"><div><label htmlFor="customerName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label><input type="text" name="name" id="customerName" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label><input type="email" name="email" id="customerEmail" value={formData.email} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Téléphone</label><input type="tel" name="phone" id="customerPhone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="customerAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Adresse</label><textarea name="address" id="customerAddress" value={formData.address} onChange={handleChange} rows="3" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"></textarea></div><div className="pt-4 flex justify-end space-x-3"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border dark:border-gray-500">Annuler</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">{customer ? "Enregistrer" : "Ajouter"}</button></div></form></Modal>);
};

const SupplierFormModal = ({ isOpen, onClose, onSave, supplier }) => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
    useEffect(() => { if (supplier) setFormData(supplier); else setFormData({ name: '', email: '', phone: '', address: '' });}, [supplier, isOpen]);
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value }));};
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData);};
    return (<Modal isOpen={isOpen} onClose={onClose} title={supplier ? "Modifier Fournisseur" : "Ajouter Fournisseur"} size="lg"><form onSubmit={handleSubmit} className="space-y-4"><div><label htmlFor="supplierName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label><input type="text" name="name" id="supplierName" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="supplierEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label><input type="email" name="email" id="supplierEmail" value={formData.email} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="supplierPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Téléphone</label><input type="tel" name="phone" id="supplierPhone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="supplierAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Adresse</label><textarea name="address" id="supplierAddress" value={formData.address} onChange={handleChange} rows="3" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"></textarea></div><div className="pt-4 flex justify-end space-x-3"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border dark:border-gray-500">Annuler</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">{supplier ? "Enregistrer" : "Ajouter"}</button></div></form></Modal>);
};

const ProductFormModal = ({ isOpen, onClose, onSave, product, suppliers, warehouses }) => {
    const [formData, setFormData] = useState({ name: '', category: '', description: '', purchasePrice: 0, salePrice: 0, stock: 0, unit: 'pièce', imageUrl: '', supplierId: '', warehouseId: '' }); const [imagePreview, setImagePreview] = useState('');
    useEffect(() => { if (product) { setFormData(product); setImagePreview(product.imageUrl); } else { setFormData({ name: '', category: '', description: '', purchasePrice: 0, salePrice: 0, stock: 0, unit: 'pièce', imageUrl: '', supplierId: '', warehouseId: '' }); setImagePreview('');}}, [product, isOpen]);
    const handleChange = (e) => { const { name, value, type } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));};
    const handleImageChange = (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setImagePreview(reader.result); setFormData(prev => ({ ...prev, imageUrl: reader.result })); }; reader.readAsDataURL(file); } else { if (!product?.imageUrl) { setImagePreview(''); setFormData(prev => ({ ...prev, imageUrl: '' })); } else { setImagePreview(product.imageUrl); setFormData(prev => ({ ...prev, imageUrl: product.imageUrl }));}}};
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData);};
    return (<Modal isOpen={isOpen} onClose={onClose} title={product ? "Modifier Produit" : "Ajouter Produit"} size="2xl"><form onSubmit={handleSubmit} className="space-y-4"><div className="grid md:grid-cols-2 gap-4"><div><label htmlFor="productName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label><input type="text" name="name" id="productName" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="productCategory" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Catégorie</label><input type="text" name="category" id="productCategory" value={formData.category} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div></div><div><label htmlFor="productDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label><textarea name="description" id="productDescription" value={formData.description} onChange={handleChange} rows="3" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"></textarea></div><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><div><label htmlFor="productPurchasePrice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prix d'achat</label><input type="number" name="purchasePrice" id="productPurchasePrice" value={formData.purchasePrice} onChange={handleChange} step="0.01" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="productSalePrice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prix de vente</label><input type="number" name="salePrice" id="productSalePrice" value={formData.salePrice} onChange={handleChange} step="0.01" required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="productStock" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Stock</label><input type="number" name="stock" id="productStock" value={formData.stock} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="productUnit" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unité</label><input type="text" name="unit" id="productUnit" value={formData.unit} onChange={handleChange} placeholder="ex: pièce, kg" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div></div><div className="grid md:grid-cols-2 gap-4"><div><label htmlFor="productSupplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fournisseur</label><select name="supplierId" id="productSupplier" value={formData.supplierId} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"><option value="">Sélectionner</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label htmlFor="productWarehouse" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entrepôt</label><select name="warehouseId" id="productWarehouse" value={formData.warehouseId} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"><option value="">Sélectionner</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div></div><div><label htmlFor="productImageUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Image</label><div className="mt-1 flex items-center space-x-4">{imagePreview ? (<img src={imagePreview} alt="Aperçu" className="h-20 w-20 object-contain rounded-md bg-gray-100 dark:bg-gray-700 p-1" />) : (<div className="h-20 w-20 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md text-gray-400 dark:text-gray-500"><ImageIcon size={32} /></div>)}<input type="file" name="imageUrl" id="productImageUrl" onChange={handleImageChange} accept="image/*" className={`block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800 cursor-pointer`}/></div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Image par défaut si non fournie.</p></div><div className="pt-4 flex justify-end space-x-3"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border dark:border-gray-500">Annuler</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">{product ? "Enregistrer" : "Ajouter"}</button></div></form></Modal>);
};

const WarehouseFormModal = ({ isOpen, onClose, onSave, warehouse }) => {
    const [formData, setFormData] = useState({ name: '', location: '', capacity: '', manager: '' });
    useEffect(() => { if (warehouse) setFormData(warehouse); else setFormData({ name: '', location: '', capacity: '', manager: '' });}, [warehouse, isOpen]);
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value }));};
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData);};
    return (<Modal isOpen={isOpen} onClose={onClose} title={warehouse ? "Modifier Entrepôt" : "Ajouter Entrepôt"} size="lg"><form onSubmit={handleSubmit} className="space-y-4"><div><label htmlFor="warehouseName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label><input type="text" name="name" id="warehouseName" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="warehouseLocation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Lieu</label><input type="text" name="location" id="warehouseLocation" value={formData.location} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="warehouseCapacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Capacité</label><input type="number" name="capacity" id="warehouseCapacity" value={formData.capacity} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="warehouseManager" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Responsable</label><input type="text" name="manager" id="warehouseManager" value={formData.manager} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div className="pt-4 flex justify-end space-x-3"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border dark:border-gray-500">Annuler</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">{warehouse ? "Enregistrer" : "Ajouter"}</button></div></form></Modal>);
};

const InvoiceFormModal = ({ isOpen, onClose, onSave, invoice, customers, products, companyInfo }) => {
    const defaultItem = useMemo(() => ({ productId: '', quantity: 1, unitPrice: 0, totalPrice: 0, productName: '', productImage: '', applyVAT: true }), []);
    const [formData, setFormData] = useState({ customerId: '', date: new Date().toISOString().split('T')[0], dueDate: '', items: [defaultItem], notes: '', taxRate: companyInfo.defaultTaxRate || 0.19, status: 'En attente',});
    
    useEffect(() => { 
        if (invoice) { 
            const formattedInvoice = { 
                ...invoice, 
                date: formatDateForInput(invoice.date), 
                dueDate: formatDateForInput(invoice.dueDate), 
                paymentDate: invoice.paymentDate ? formatDateForInput(invoice.paymentDate) : null, 
                status: invoice.status || 'En attente', 
                items: invoice.items.map(item => ({ ...item, applyVAT: item.applyVAT === undefined ? true : item.applyVAT })), 
                taxRate: invoice.taxRate === undefined ? (companyInfo.defaultTaxRate || 0.19) : invoice.taxRate,
            }; 
            setFormData(formattedInvoice); 
        } else { 
            const today = new Date(); 
            const dueDate = new Date(today); 
            dueDate.setDate(today.getDate() + 30); 
            setFormData({ 
                customerId: '', 
                date: today.toISOString().split('T')[0], 
                dueDate: dueDate.toISOString().split('T')[0], 
                items: [{...defaultItem}], 
                notes: '', 
                taxRate: companyInfo.defaultTaxRate || 0.19, 
                status: 'En attente', 
            });
        }
    }, [invoice, isOpen, companyInfo.defaultTaxRate, products, defaultItem]);
    
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value }));};
    const handleItemChange = (index, field, value) => { const newItems = [...formData.items]; if (field === 'applyVAT') { newItems[index][field] = value; } else { newItems[index][field] = value;} if (field === 'productId') { const product = products.find(p => p.id === value); if (product) { newItems[index].unitPrice = product.salePrice; newItems[index].productName = product.name; newItems[index].productImage = product.imageUrl; } else { newItems[index].unitPrice = 0; newItems[index].productName = ''; newItems[index].productImage = '';}} const quantity = parseFloat(newItems[index].quantity) || 0; const unitPrice = parseFloat(newItems[index].unitPrice) || 0; newItems[index].totalPrice = quantity * unitPrice; setFormData(prev => ({ ...prev, items: newItems }));};
    const addItem = () => { setFormData(prev => ({ ...prev, items: [...prev.items, {...defaultItem}] }));};
    const removeItem = (index) => { const newItems = formData.items.filter((_, i) => i !== index); setFormData(prev => ({ ...prev, items: newItems.length > 0 ? newItems : [{...defaultItem}] }));};
    const calculateTotals = () => { const subTotal = formData.items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0); const taxAmount = formData.items.reduce((sum, item) => { if (item.applyVAT) { return sum + (parseFloat(item.totalPrice) || 0) * (parseFloat(formData.taxRate) || 0); } return sum; }, 0); const totalAmount = subTotal + taxAmount; return { subTotal, taxAmount, totalAmount };};
    const { subTotal, taxAmount, totalAmount } = calculateTotals();
    const handleSubmit = (e) => { e.preventDefault(); const customer = customers.find(c => c.id === formData.customerId); onSave({ ...formData, subTotal, taxAmount, totalAmount, customerName: customer ? customer.name : 'N/A',});};
    return (<Modal isOpen={isOpen} onClose={onClose} title={invoice ? "Modifier Facture" : "Créer Facture"} size="4xl"><form onSubmit={handleSubmit} className="space-y-6"><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><div><label htmlFor="customerId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Client</label><select name="customerId" id="customerId" value={formData.customerId} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"><option value="">Sélectionner</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date émission</label><input type="date" name="date" id="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date échéance</label><input type="date" name="dueDate" id="dueDate" value={formData.dueDate} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Statut</label><select name="status" id="status" value={formData.status} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white">{invoiceStatuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div></div><div className="space-y-3"><h4 className="text-md font-medium text-gray-700 dark:text-gray-300">Articles</h4>{formData.items.map((item, index) => (<div key={index} className="grid grid-cols-12 gap-x-3 gap-y-2 items-end p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
        {/* Product Select */}
        <div className="col-span-12 sm:col-span-3 md:col-span-3"><label className="text-xs text-gray-600 dark:text-gray-400">Produit</label><select value={item.productId} onChange={(e) => handleItemChange(index, 'productId', e.target.value)} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"><option value="">Choisir...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        {/* Quantity */}
        <div className="col-span-4 sm:col-span-2 md:col-span-2"><label className="text-xs text-gray-600 dark:text-gray-400">Qté</label><input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="0" className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white" /></div>
        {/* Unit Price */}
        <div className="col-span-4 sm:col-span-2 md:col-span-2"><label className="text-xs text-gray-600 dark:text-gray-400">P.U.</label><input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)} step="0.01" min="0" className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white" /></div>
        {/* Total Price */}
        <div className="col-span-4 sm:col-span-2 md:col-span-2"><label className="text-xs text-gray-600 dark:text-gray-400">Total Article</label><input type="text" value={formatCurrency(item.totalPrice, companyInfo.currency)} readOnly className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-md text-sm bg-gray-100 dark:bg-gray-600 dark:text-gray-300" /></div>
        {/* Apply VAT Checkbox */}
        <div className="col-span-10 sm:col-span-2 md:col-span-2 flex items-center pt-5"><input type="checkbox" id={`applyVAT-${index}`} checked={item.applyVAT} onChange={(e) => handleItemChange(index, 'applyVAT', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"/><label htmlFor={`applyVAT-${index}`} className="ml-2 text-xs text-gray-600 dark:text-gray-400">Appliquer TVA</label></div>
        {/* Delete Button */}
        <div className="col-span-2 sm:col-span-1 flex items-center justify-end"><button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-gray-600"><Trash2 size={18} /></button></div>
    </div>))}<button type="button" onClick={addItem} className="flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-1.5 px-3 rounded-md hover:bg-blue-50 dark:hover:bg-gray-700"><PlusCircle size={16} className="mr-1.5" /> Ajouter article</button></div><div className="grid md:grid-cols-2 gap-6"><div><label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes / Termes</label><textarea name="notes" id="notes" value={formData.notes} onChange={handleChange} rows="3" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"></textarea></div><div className="space-y-2 pt-2 text-right"><div className="flex justify-between items-center"><span className="text-sm text-gray-600 dark:text-gray-300">Sous-total:</span><span className="font-semibold text-gray-800 dark:text-white">{formatCurrency(subTotal, companyInfo.currency)}</span></div><div className="flex justify-between items-center"><label htmlFor="taxRate" className="text-sm text-gray-600 dark:text-gray-300">TVA Globale (%):</label><input type="number" name="taxRate" value={formData.taxRate * 100} onChange={(e) => { const rate = parseFloat(e.target.value); setFormData(prev => ({...prev, taxRate: isNaN(rate) ? 0 : rate / 100 }));}} step="1" max="100" min="0" className="w-20 p-1 border dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white text-right" /></div><div className="flex justify-between items-center"><span className="text-sm text-gray-600 dark:text-gray-300">Montant TVA:</span><span className="font-semibold text-gray-800 dark:text-white">{formatCurrency(taxAmount, companyInfo.currency)}</span></div><div className="flex justify-between items-center border-t pt-2 dark:border-gray-600"><span className="text-lg font-bold text-gray-800 dark:text-white">TOTAL:</span><span className="text-lg font-bold text-gray-800 dark:text-white">{formatCurrency(totalAmount, companyInfo.currency)}</span></div></div></div><div className="pt-6 flex justify-end space-x-3 border-t dark:border-gray-700"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border dark:border-gray-500">Annuler</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">{invoice ? "Enregistrer" : "Créer Facture"}</button></div></form></Modal>);
};

const InvoicePreviewModal = ({ isOpen, onClose, invoice, companyInfo, customers: allCustomers }) => {
    if (!invoice) return null;
    const customer = allCustomers.find(c => c.id === invoice.customerId) || { name: invoice.customerName, address: '', email: '', phone: '' }; 
    const handlePrint = () => { const printContents = document.getElementById('invoice-preview-content').innerHTML; const darkModeEnabled = document.documentElement.classList.contains('dark'); const printWindow = window.open('', '_blank', 'height=800,width=800'); printWindow.document.write('<html><head><title>Facture</title><script src="https://cdn.tailwindcss.com"></script><style> body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } @media print { .print-hidden { display: none !important; } .print-text-black { color: black !important; } .print-bg-white { background-color: white !important; } .print-border-black { border-color: black !important; } } </style></head><body>'); if (darkModeEnabled) { printWindow.document.write(`<div class="print-bg-white print-text-black">${printContents}</div>`); } else { printWindow.document.write(printContents); } printWindow.document.write('</body></html>'); printWindow.document.close(); printWindow.focus(); setTimeout(() => { printWindow.print(); printWindow.close(); }, 250); };
    return (<Modal isOpen={isOpen} onClose={onClose} title={`Aperçu Facture: ${invoice.id}`} size="4xl"><div id="invoice-preview-content" className="p-6 bg-white dark:bg-gray-800 text-gray-800 dark:text-white"><div className="flex justify-between items-start mb-8 pb-4 border-b dark:border-gray-700 print-border-black"><div className="flex items-start flex-1 pr-4">{companyInfo.logoUrl && (<div className="flex-shrink-0 w-36 mr-6"><img src={companyInfo.logoUrl} alt="Logo Entreprise" className="h-24 print:h-20 object-contain w-full" onError={(e) => e.target.style.display='none'} /></div>)}<div className="flex-grow"><h2 className={`font-bold text-blue-600 dark:text-blue-400 print-text-black mb-1 leading-tight ${companyInfo.logoUrl ? 'text-2xl' : 'text-3xl'}`}>{companyInfo.name}</h2><p className="text-sm print-text-black">{companyInfo.address}</p><p className="text-sm print-text-black">Tél: {companyInfo.phone} | Email: {companyInfo.email}</p><p className="text-sm print-text-black">N° TVA: {companyInfo.vatNumber}</p></div></div><div className="text-right flex-shrink-0"><h2 className="text-3xl font-semibold uppercase text-gray-700 dark:text-gray-300 print-text-black">Facture</h2><p className="text-sm print-text-black">Numéro: <span className="font-medium">{invoice.id}</span></p><p className="text-sm print-text-black">Date: <span className="font-medium">{formatDateForInput(invoice.date)}</span></p><p className="text-sm print-text-black">Échéance: <span className="font-medium">{formatDateForInput(invoice.dueDate)}</span></p></div></div><div className="mb-8"><h3 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 print-text-black mb-1">Facturé à:</h3><p className="font-medium text-lg print-text-black">{customer.name}</p>{customer.address && <p className="text-sm print-text-black">{customer.address}</p>}{customer.email && <p className="text-sm print-text-black">{customer.email}</p>}{customer.phone && <p className="text-sm print-text-black">{customer.phone}</p>}</div><table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600 print-divide-black mb-8"><thead className="bg-gray-100 dark:bg-gray-700 print-bg-gray-100"><tr><th className="px-4 py-2 text-left text-xs font-medium uppercase print-text-black">Produit/Service</th><th className="px-4 py-2 text-center text-xs font-medium uppercase print-text-black">Qté</th><th className="px-4 py-2 text-right text-xs font-medium uppercase print-text-black">P.U.</th><th className="px-4 py-2 text-center text-xs font-medium uppercase print-text-black">TVA (%)</th><th className="px-4 py-2 text-right text-xs font-medium uppercase print-text-black">Total HT</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700 print-divide-gray-300">{invoice.items.map((item, index) => (<tr key={index}><td className="px-4 py-3 whitespace-nowrap print-text-black"><div className="flex items-center">{item.productImage && <img src={item.productImage} alt={item.productName} className="h-10 w-10 object-cover rounded mr-3 print-hidden" onError={(e) => { e.target.style.display='none'; }}/>}<div><p className="font-medium print-text-black">{item.productName}</p></div></div></td><td className="px-4 py-3 whitespace-nowrap text-center print-text-black">{item.quantity}</td><td className="px-4 py-3 whitespace-nowrap text-right print-text-black">{formatCurrency(item.unitPrice, companyInfo.currency)}</td><td className="px-4 py-3 whitespace-nowrap text-center print-text-black">{item.applyVAT && invoice.taxRate ? (invoice.taxRate * 100).toFixed(0) + '%' : '0%'}</td><td className="px-4 py-3 whitespace-nowrap text-right print-text-black">{formatCurrency(item.totalPrice, companyInfo.currency)}</td></tr>))}</tbody></table><div className="flex justify-end mb-8"><div className="w-full max-w-xs space-y-2 text-sm print-text-black"><div className="flex justify-between"><span>Sous-total HT:</span><span>{formatCurrency(invoice.subTotal, companyInfo.currency)}</span></div><div className="flex justify-between"><span>TVA ({invoice.taxRate * 100}%):</span><span>{formatCurrency(invoice.taxAmount, companyInfo.currency)}</span></div><div className="flex justify-between font-bold text-lg border-t pt-2 dark:border-gray-600 print-border-black"><span>TOTAL TTC:</span><span>{formatCurrency(invoice.totalAmount, companyInfo.currency)}</span></div></div></div>{invoice.notes && (<div className="mb-8 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md print-bg-gray-50"><h4 className="font-semibold text-sm mb-1 print-text-black">Notes:</h4><p className="text-xs whitespace-pre-line print-text-black">{invoice.notes}</p></div>)}<div className="text-center text-xs text-gray-500 dark:text-gray-400 print-text-black pt-4 border-t dark:border-gray-700 print-border-black">Merci. Paiement: {formatDateForInput(invoice.dueDate)}.</div></div><div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 flex justify-end space-x-3 print-hidden"><button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border dark:border-gray-500">Fermer</button><button id="invoice-print-button-modal" onClick={handlePrint} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"><Printer size={16} className="mr-2" /> Imprimer/PDF</button></div></Modal>);
};


// START: Quotes Components
const QuoteFormModal = ({ isOpen, onClose, onSave, quote, customers, products, companyInfo }) => {
    const defaultItem = useMemo(() => ({ productId: '', quantity: 1, unitPrice: 0, totalPrice: 0, productName: '', productImage: '', applyVAT: true }), []);
    const [formData, setFormData] = useState({ customerId: '', date: new Date().toISOString().split('T')[0], expiryDate: '', items: [defaultItem], notes: '', taxRate: companyInfo.defaultTaxRate || 0.19, status: 'Brouillon',});
    
    useEffect(() => { 
        if (quote) { 
            const formattedQuote = { 
                ...quote, 
                date: formatDateForInput(quote.date), 
                expiryDate: formatDateForInput(quote.expiryDate), 
                status: quote.status || 'Brouillon', 
                items: quote.items.map(item => ({ ...item, applyVAT: item.applyVAT === undefined ? true : item.applyVAT })), 
                taxRate: quote.taxRate === undefined ? (companyInfo.defaultTaxRate || 0.19) : quote.taxRate,
            }; 
            setFormData(formattedQuote); 
        } else { 
            const today = new Date(); 
            const expiryDate = new Date(today); 
            expiryDate.setDate(today.getDate() + 30); 
            setFormData({ 
                customerId: '', 
                date: today.toISOString().split('T')[0], 
                expiryDate: expiryDate.toISOString().split('T')[0], 
                items: [{...defaultItem}], 
                notes: '', 
                taxRate: companyInfo.defaultTaxRate || 0.19, 
                status: 'Brouillon', 
            });
        }
    }, [quote, isOpen, companyInfo.defaultTaxRate, products, defaultItem]);
    
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value }));};
    const handleItemChange = (index, field, value) => { const newItems = [...formData.items]; if (field === 'applyVAT') { newItems[index][field] = value; } else { newItems[index][field] = value;} if (field === 'productId') { const product = products.find(p => p.id === value); if (product) { newItems[index].unitPrice = product.salePrice; newItems[index].productName = product.name; newItems[index].productImage = product.imageUrl; } else { newItems[index].unitPrice = 0; newItems[index].productName = ''; newItems[index].productImage = '';}} const quantity = parseFloat(newItems[index].quantity) || 0; const unitPrice = parseFloat(newItems[index].unitPrice) || 0; newItems[index].totalPrice = quantity * unitPrice; setFormData(prev => ({ ...prev, items: newItems }));};
    const addItem = () => { setFormData(prev => ({ ...prev, items: [...prev.items, {...defaultItem}] }));};
    const removeItem = (index) => { const newItems = formData.items.filter((_, i) => i !== index); setFormData(prev => ({ ...prev, items: newItems.length > 0 ? newItems : [{...defaultItem}] }));};
    const calculateTotals = () => { const subTotal = formData.items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0); const taxAmount = formData.items.reduce((sum, item) => { if (item.applyVAT) { return sum + (parseFloat(item.totalPrice) || 0) * (parseFloat(formData.taxRate) || 0); } return sum; }, 0); const totalAmount = subTotal + taxAmount; return { subTotal, taxAmount, totalAmount };};
    const { subTotal, taxAmount, totalAmount } = calculateTotals();
    const handleSubmit = (e) => { e.preventDefault(); const customer = customers.find(c => c.id === formData.customerId); onSave({ ...formData, subTotal, taxAmount, totalAmount, customerName: customer ? customer.name : 'N/A',});};
    return (<Modal isOpen={isOpen} onClose={onClose} title={quote ? "Modifier Devis" : "Créer Devis"} size="4xl"><form onSubmit={handleSubmit} className="space-y-6"><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><div><label htmlFor="customerId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Client</label><select name="customerId" id="customerId" value={formData.customerId} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"><option value="">Sélectionner</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date émission</label><input type="date" name="date" id="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date expiration</label><input type="date" name="expiryDate" id="expiryDate" value={formData.expiryDate} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Statut</label><select name="status" id="status" value={formData.status} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white">{quoteStatuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div></div><div className="space-y-3"><h4 className="text-md font-medium text-gray-700 dark:text-gray-300">Articles</h4>{formData.items.map((item, index) => (<div key={index} className="grid grid-cols-12 gap-x-3 gap-y-2 items-end p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
        {/* Product Select */}
        <div className="col-span-12 sm:col-span-3 md:col-span-3"><label className="text-xs text-gray-600 dark:text-gray-400">Produit</label><select value={item.productId} onChange={(e) => handleItemChange(index, 'productId', e.target.value)} className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"><option value="">Choisir...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        {/* Quantity */}
        <div className="col-span-4 sm:col-span-2 md:col-span-2"><label className="text-xs text-gray-600 dark:text-gray-400">Qté</label><input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="0" className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white" /></div>
        {/* Unit Price */}
        <div className="col-span-4 sm:col-span-2 md:col-span-2"><label className="text-xs text-gray-600 dark:text-gray-400">P.U.</label><input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)} step="0.01" min="0" className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white" /></div>
        {/* Total Price */}
        <div className="col-span-4 sm:col-span-2 md:col-span-2"><label className="text-xs text-gray-600 dark:text-gray-400">Total Article</label><input type="text" value={formatCurrency(item.totalPrice, companyInfo.currency)} readOnly className="mt-1 block w-full p-2 border dark:border-gray-600 rounded-md text-sm bg-gray-100 dark:bg-gray-600 dark:text-gray-300" /></div>
        {/* Apply VAT Checkbox */}
        <div className="col-span-10 sm:col-span-2 md:col-span-2 flex items-center pt-5"><input type="checkbox" id={`applyVAT-quote-${index}`} checked={item.applyVAT} onChange={(e) => handleItemChange(index, 'applyVAT', e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"/><label htmlFor={`applyVAT-quote-${index}`} className="ml-2 text-xs text-gray-600 dark:text-gray-400">Appliquer TVA</label></div>
        {/* Delete Button */}
        <div className="col-span-2 sm:col-span-1 flex items-center justify-end"><button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-gray-600"><Trash2 size={18} /></button></div>
    </div>))}<button type="button" onClick={addItem} className="flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-1.5 px-3 rounded-md hover:bg-blue-50 dark:hover:bg-gray-700"><PlusCircle size={16} className="mr-1.5" /> Ajouter article</button></div><div className="grid md:grid-cols-2 gap-6"><div><label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes / Termes</label><textarea name="notes" id="notes" value={formData.notes} onChange={handleChange} rows="3" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"></textarea></div><div className="space-y-2 pt-2 text-right"><div className="flex justify-between items-center"><span className="text-sm text-gray-600 dark:text-gray-300">Sous-total:</span><span className="font-semibold text-gray-800 dark:text-white">{formatCurrency(subTotal, companyInfo.currency)}</span></div><div className="flex justify-between items-center"><label htmlFor="taxRate" className="text-sm text-gray-600 dark:text-gray-300">TVA Globale (%):</label><input type="number" name="taxRate" value={formData.taxRate * 100} onChange={(e) => { const rate = parseFloat(e.target.value); setFormData(prev => ({...prev, taxRate: isNaN(rate) ? 0 : rate / 100 }));}} step="1" max="100" min="0" className="w-20 p-1 border dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white text-right" /></div><div className="flex justify-between items-center"><span className="text-sm text-gray-600 dark:text-gray-300">Montant TVA:</span><span className="font-semibold text-gray-800 dark:text-white">{formatCurrency(taxAmount, companyInfo.currency)}</span></div><div className="flex justify-between items-center border-t pt-2 dark:border-gray-600"><span className="text-lg font-bold text-gray-800 dark:text-white">TOTAL:</span><span className="text-lg font-bold text-gray-800 dark:text-white">{formatCurrency(totalAmount, companyInfo.currency)}</span></div></div></div><div className="pt-6 flex justify-end space-x-3 border-t dark:border-gray-700"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border dark:border-gray-500">Annuler</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">{quote ? "Enregistrer" : "Créer Devis"}</button></div></form></Modal>);
};

const QuotePreviewModal = ({ isOpen, onClose, quote, companyInfo, customers: allCustomers }) => {
    if (!quote) return null;
    const customer = allCustomers.find(c => c.id === quote.customerId) || { name: quote.customerName, address: '', email: '', phone: '' }; 
    const handlePrint = () => { const printContents = document.getElementById('quote-preview-content').innerHTML; const darkModeEnabled = document.documentElement.classList.contains('dark'); const printWindow = window.open('', '_blank', 'height=800,width=800'); printWindow.document.write('<html><head><title>Devis</title><script src="https://cdn.tailwindcss.com"></script><style> body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } @media print { .print-hidden { display: none !important; } .print-text-black { color: black !important; } .print-bg-white { background-color: white !important; } .print-border-black { border-color: black !important; } } </style></head><body>'); if (darkModeEnabled) { printWindow.document.write(`<div class="print-bg-white print-text-black">${printContents}</div>`); } else { printWindow.document.write(printContents); } printWindow.document.write('</body></html>'); printWindow.document.close(); printWindow.focus(); setTimeout(() => { printWindow.print(); printWindow.close(); }, 250); };
    return (<Modal isOpen={isOpen} onClose={onClose} title={`Aperçu Devis: ${quote.id}`} size="4xl"><div id="quote-preview-content" className="p-6 bg-white dark:bg-gray-800 text-gray-800 dark:text-white"><div className="flex justify-between items-start mb-8 pb-4 border-b dark:border-gray-700 print-border-black"><div className="flex items-start flex-1 pr-4">{companyInfo.logoUrl && (<div className="flex-shrink-0 w-36 mr-6"><img src={companyInfo.logoUrl} alt="Logo Entreprise" className="h-24 print:h-20 object-contain w-full" onError={(e) => e.target.style.display='none'} /></div>)}<div className="flex-grow"><h2 className={`font-bold text-blue-600 dark:text-blue-400 print-text-black mb-1 leading-tight ${companyInfo.logoUrl ? 'text-2xl' : 'text-3xl'}`}>{companyInfo.name}</h2><p className="text-sm print-text-black">{companyInfo.address}</p><p className="text-sm print-text-black">Tél: {companyInfo.phone} | Email: {companyInfo.email}</p><p className="text-sm print-text-black">N° TVA: {companyInfo.vatNumber}</p></div></div><div className="text-right flex-shrink-0"><h2 className="text-3xl font-semibold uppercase text-gray-700 dark:text-gray-300 print-text-black">Devis</h2><p className="text-sm print-text-black">Numéro: <span className="font-medium">{quote.id}</span></p><p className="text-sm print-text-black">Date: <span className="font-medium">{formatDateForInput(quote.date)}</span></p><p className="text-sm print-text-black">Expiration: <span className="font-medium">{formatDateForInput(quote.expiryDate)}</span></p></div></div><div className="mb-8"><h3 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 print-text-black mb-1">Adressé à:</h3><p className="font-medium text-lg print-text-black">{customer.name}</p>{customer.address && <p className="text-sm print-text-black">{customer.address}</p>}{customer.email && <p className="text-sm print-text-black">{customer.email}</p>}{customer.phone && <p className="text-sm print-text-black">{customer.phone}</p>}</div><table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600 print-divide-black mb-8"><thead className="bg-gray-100 dark:bg-gray-700 print-bg-gray-100"><tr><th className="px-4 py-2 text-left text-xs font-medium uppercase print-text-black">Produit/Service</th><th className="px-4 py-2 text-center text-xs font-medium uppercase print-text-black">Qté</th><th className="px-4 py-2 text-right text-xs font-medium uppercase print-text-black">P.U.</th><th className="px-4 py-2 text-center text-xs font-medium uppercase print-text-black">TVA (%)</th><th className="px-4 py-2 text-right text-xs font-medium uppercase print-text-black">Total HT</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700 print-divide-gray-300">{quote.items.map((item, index) => (<tr key={index}><td className="px-4 py-3 whitespace-nowrap print-text-black"><div className="flex items-center">{item.productImage && <img src={item.productImage} alt={item.productName} className="h-10 w-10 object-cover rounded mr-3 print-hidden" onError={(e) => { e.target.style.display='none'; }}/>}<div><p className="font-medium print-text-black">{item.productName}</p></div></div></td><td className="px-4 py-3 whitespace-nowrap text-center print-text-black">{item.quantity}</td><td className="px-4 py-3 whitespace-nowrap text-right print-text-black">{formatCurrency(item.unitPrice, companyInfo.currency)}</td><td className="px-4 py-3 whitespace-nowrap text-center print-text-black">{item.applyVAT && quote.taxRate ? (quote.taxRate * 100).toFixed(0) + '%' : '0%'}</td><td className="px-4 py-3 whitespace-nowrap text-right print-text-black">{formatCurrency(item.totalPrice, companyInfo.currency)}</td></tr>))}</tbody></table><div className="flex justify-end mb-8"><div className="w-full max-w-xs space-y-2 text-sm print-text-black"><div className="flex justify-between"><span>Sous-total HT:</span><span>{formatCurrency(quote.subTotal, companyInfo.currency)}</span></div><div className="flex justify-between"><span>TVA ({quote.taxRate * 100}%):</span><span>{formatCurrency(quote.taxAmount, companyInfo.currency)}</span></div><div className="flex justify-between font-bold text-lg border-t pt-2 dark:border-gray-600 print-border-black"><span>TOTAL TTC:</span><span>{formatCurrency(quote.totalAmount, companyInfo.currency)}</span></div></div></div>{quote.notes && (<div className="mb-8 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md print-bg-gray-50"><h4 className="font-semibold text-sm mb-1 print-text-black">Notes:</h4><p className="text-xs whitespace-pre-line print-text-black">{quote.notes}</p></div>)}<div className="text-center text-xs text-gray-500 dark:text-gray-400 print-text-black pt-4 border-t dark:border-gray-700 print-border-black">Ce devis est valable jusqu'au {formatDateForInput(quote.expiryDate)}.</div></div><div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 flex justify-end space-x-3 print-hidden"><button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border dark:border-gray-500">Fermer</button><button id="quote-print-button-modal" onClick={handlePrint} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"><Printer size={16} className="mr-2" /> Imprimer/PDF</button></div></Modal>);
};

// --- Page Components (Defined after their Modals) ---
const DashboardPage = ({ invoices, products, customers, companyInfo, db, userId, appId }) => {
    const [stats, setStats] = useState({ totalRevenue: 0, unpaidInvoices: 0, paidInvoices: 0, activeCustomers: 0, lowStockItems: 0 });
    const [monthlySalesData, setMonthlySalesData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !userId || !appId || !Array.isArray(invoices) || !Array.isArray(products) || !Array.isArray(customers)) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        // Calculate general stats
        const totalRevenue = invoices.filter(inv => inv.status === 'Payée').reduce((sum, inv) => sum + inv.totalAmount, 0);
        const unpaidInvoices = invoices.filter(inv => inv.status === 'En attente' || inv.status === 'En retard').length;
        const paidInvoicesCount = invoices.filter(inv => inv.status === 'Payée').length;
        const activeCustomers = customers.length;
        const lowStockItems = products.filter(p => p.stock !== Infinity && p.stock < (companyInfo.lowStockThreshold || 10)).length;
        
        setStats({ totalRevenue, unpaidInvoices, paidInvoices: paidInvoicesCount, activeCustomers, lowStockItems });

        // Prepare monthly sales data for the chart
        const salesByMonth = {};
        const currentYear = new Date().getFullYear();

        invoices.forEach(invoice => {
            if (invoice.status === 'Payée' && invoice.paymentDate) {
                const paymentDate = new Date(invoice.paymentDate);
                if (paymentDate.getFullYear() === currentYear) {
                    const month = paymentDate.toLocaleString('fr-FR', { month: 'short' }).replace('.', ''); // e.g., "janv." -> "janv"
                    const monthKey = `${month.charAt(0).toUpperCase() + month.slice(1)}`; // Capitalize: "Janv"
                    
                    if (!salesByMonth[monthKey]) {
                        salesByMonth[monthKey] = { sales: 0, invoiceCount: 0, monthIndex: paymentDate.getMonth() };
                    }
                    salesByMonth[monthKey].sales += invoice.totalAmount;
                    salesByMonth[monthKey].invoiceCount += 1;
                }
            }
        });

        const frenchMonths = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
        const chartData = frenchMonths.map((monthName, index) => ({
            name: monthName,
            sales: salesByMonth[monthName] ? salesByMonth[monthName].sales : 0,
            invoiceCount: salesByMonth[monthName] ? salesByMonth[monthName].invoiceCount : 0,
            monthIndex: index
        }));
        
        setMonthlySalesData(chartData);
        setIsLoading(false);

    }, [invoices, products, customers, companyInfo, db, userId, appId]);


    if (isLoading) return <div className="flex justify-center items-center h-full"><p>Chargement du tableau de bord...</p></div>;

    const statCards = [
        { title: "Chiffre d'affaires (Payé)", value: formatCurrency(stats.totalRevenue, companyInfo.currency), icon: DollarSign, color: 'green' },
        { title: "Factures Impayées", value: stats.unpaidInvoices, icon: FileText, color: 'red' },
        { title: "Factures Payées", value: stats.paidInvoices, icon: ClipboardList, color: 'blue' },
        { title: "Clients Actifs", value: stats.activeCustomers, icon: Users, color: 'purple' },
        { title: "Produits en Stock Faible", value: stats.lowStockItems, icon: Package, color: 'yellow', link: 'products' },
    ];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {statCards.map(card => (
                    <div key={card.title} className={`p-6 rounded-xl shadow-lg flex items-center space-x-4 bg-white dark:bg-gray-800 border-l-4 ${
                        card.color === 'green' ? 'border-green-500' :
                        card.color === 'red' ? 'border-red-500' :
                        card.color === 'blue' ? 'border-blue-500' :
                        card.color === 'purple' ? 'border-purple-500' :
                        'border-yellow-500' // Default for yellow or other
                    }`}>
                        <div className={`p-3 rounded-full ${
                            card.color === 'green' ? 'bg-green-100 dark:bg-green-800/30 text-green-600 dark:text-green-400' :
                            card.color === 'red' ? 'bg-red-100 dark:bg-red-800/30 text-red-600 dark:text-red-400' :
                            card.color === 'blue' ? 'bg-blue-100 dark:bg-blue-800/30 text-blue-600 dark:text-blue-400' :
                            card.color === 'purple' ? 'bg-purple-100 dark:bg-purple-800/30 text-purple-600 dark:text-purple-400' :
                            'bg-yellow-100 dark:bg-yellow-800/30 text-yellow-600 dark:text-yellow-400'
                        }`}>
                            <card.icon size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{card.title}</p>
                            <p className="text-2xl font-semibold text-gray-800 dark:text-white">{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-1">Ventes Mensuelles ({new Date().getFullYear()})</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Basé sur les factures payées.</p>
                <PaymentStatsChart data={monthlySalesData} currency={companyInfo.currency} />
            </div>

            {/* Placeholder for recent activity or other dashboard elements */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Factures Récentes</h3>
                    {invoices.slice(0, 5).map(inv => (
                         <div key={inv.id} className="py-3 border-b dark:border-gray-700 last:border-b-0 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{inv.id}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{inv.customerName} - {formatDateForInput(inv.date)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(inv.totalAmount, companyInfo.currency)}</p>
                                <span className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full ${inv.status === 'Payée' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : inv.status === 'En attente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' : 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'}`}>{inv.status}</span>
                            </div>
                        </div>
                    ))}
                    {invoices.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Aucune facture récente.</p>}
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                     <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Produits en Stock Faible</h3>
                     {products.filter(p => p.stock !== Infinity && p.stock < (companyInfo.lowStockThreshold || 10)).slice(0,5).map(prod => (
                         <div key={prod.id} className="py-3 border-b dark:border-gray-700 last:border-b-0 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{prod.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{prod.category}</p>
                            </div>
                            <p className="text-sm font-semibold text-red-500 dark:text-red-400">Stock: {prod.stock} {prod.unit}</p>
                        </div>
                     ))}
                     {products.filter(p => p.stock !== Infinity && p.stock < (companyInfo.lowStockThreshold || 10)).length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Aucun produit en stock faible.</p>}
                </div>
            </div>
        </div>
    );
};


const ProductsPage = ({ products, setProducts, suppliers, warehouses, companyInfo, showConfirmationModal, db, userId, appId }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !userId || !appId) { setIsLoading(false); return; }
        setIsLoading(true);
        const productsCollectionPath = `artifacts/${appId}/users/${userId}/products`;
        const q = query(collection(db, productsCollectionPath));
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const productsFromFirestore = [];
            querySnapshot.forEach((doc) => productsFromFirestore.push({ ...doc.data(), id: doc.id }));
            setProducts(productsFromFirestore.sort((a,b) => a.name.localeCompare(b.name)));
            setIsLoading(false);
        }, (error) => { console.error("Error fetching products:", error); setIsLoading(false); });
        return () => unsubscribe();
    }, [db, userId, appId, setProducts]);

    const openFormModal = (product = null) => { setEditingProduct(product); setIsFormModalOpen(true); };
    const closeFormModal = () => { setEditingProduct(null); setIsFormModalOpen(false); };
    
    const handleSaveProduct = async (productData) => {
        if (!db || !userId || !appId) return;
        const productsCollectionPath = `artifacts/${appId}/users/${userId}/products`;
        const dataToSave = { ...productData, updatedAt: serverTimestamp() };
        try {
            if (editingProduct && editingProduct.id) {
                await setDoc(doc(db, productsCollectionPath, editingProduct.id), dataToSave, { merge: true });
            } else {
                delete dataToSave.id; 
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, productsCollectionPath), dataToSave);
            }
        } catch (error) { console.error("Error saving product:", error); }
        closeFormModal();
    };

    const handleDeleteProduct = (productId) => {
        if (!db || !userId || !appId) return;
        showConfirmationModal('Supprimer Produit', 'Sûr de vouloir supprimer ce produit ?', async () => {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/products`, productId));
            } catch (error) { console.error("Error deleting product:", error); }
        });
    };
    
    const productCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
    const filteredProducts = products.filter(p => 
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterCategory === '' || p.category === filterCategory)
    );

    if (isLoading) return <div className="flex justify-center items-center h-full"><p>Chargement des produits...</p></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">Produits & Services</h3>
                <button onClick={() => openFormModal()} className={`flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg w-full sm:w-auto`}>
                    <PlusCircle size={20} className="mr-2"/> Ajouter Produit/Service
                </button>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-col sm:flex-row gap-4">
                <input type="text" placeholder="Rechercher (Nom, Description)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-grow p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"/>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white sm:w-auto">
                    <option value="">Toutes catégories</option>
                    {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredProducts.map(p => (
                    <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
                        <div className="h-48 w-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            <img src={p.imageUrl || 'https://placehold.co/300x200/e2e8f0/94a3b8?text=Image'} alt={p.name} className="h-full w-full object-contain" onError={(e) => { e.target.src = 'https://placehold.co/300x200/e2e8f0/94a3b8?text=Image+Indisponible'; }} />
                        </div>
                        <div className="p-5 flex-grow flex flex-col justify-between">
                            <div>
                                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-1 truncate" title={p.name}>{p.name}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{p.category}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 h-10 overflow-hidden text-ellipsis" title={p.description}>{p.description || 'Aucune description.'}</p>
                            </div>
                            <div className="mt-auto">
                                <div className="flex justify-between items-center mb-3">
                                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(p.salePrice, companyInfo.currency)}</p>
                                    {p.stock === Infinity ? (
                                        <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100 rounded-full">Service</span>
                                    ) : (
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.stock < (companyInfo.lowStockThreshold || 10) ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100' : 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100'}`}>
                                            Stock: {p.stock} {p.unit}
                                        </span>
                                    )}
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => openFormModal(p)} className="flex-1 text-center bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded-md flex items-center justify-center"><Edit2 size={16} className="mr-1.5"/> Modifier</button>
                                    <button onClick={() => handleDeleteProduct(p.id)} className="flex-1 text-center bg-red-500 hover:bg-red-600 text-white text-sm py-2 px-3 rounded-md flex items-center justify-center"><Trash2 size={16} className="mr-1.5"/> Suppr.</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {filteredProducts.length === 0 && !isLoading && (<p className="text-center py-8 text-gray-500 dark:text-gray-400">Aucun produit trouvé.</p>)}
            <ProductFormModal isOpen={isFormModalOpen} onClose={closeFormModal} onSave={handleSaveProduct} product={editingProduct} suppliers={suppliers} warehouses={warehouses} />
        </div>
    );
};

const CustomersPage = ({ customers, setCustomers, showConfirmationModal, db, userId, appId }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !userId || !appId) { setIsLoading(false); return; }
        setIsLoading(true);
        const customersCollectionPath = `artifacts/${appId}/users/${userId}/customers`;
        const q = query(collection(db, customersCollectionPath));
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const customersFromFirestore = [];
            querySnapshot.forEach((doc) => customersFromFirestore.push({ ...doc.data(), id: doc.id }));
            setCustomers(customersFromFirestore.sort((a,b) => a.name.localeCompare(b.name)));
            setIsLoading(false);
        }, (error) => { console.error("Error fetching customers:", error); setIsLoading(false); });
        return () => unsubscribe();
    }, [db, userId, appId, setCustomers]);

    const openFormModal = (customer = null) => { setEditingCustomer(customer); setIsFormModalOpen(true); };
    const closeFormModal = () => { setEditingCustomer(null); setIsFormModalOpen(false); };
    
    const handleSaveCustomer = async (customerData) => {
        if (!db || !userId || !appId) return;
        const customersCollectionPath = `artifacts/${appId}/users/${userId}/customers`;
        const dataToSave = { ...customerData, updatedAt: serverTimestamp() };
        try {
            if (editingCustomer && editingCustomer.id) {
                await setDoc(doc(db, customersCollectionPath, editingCustomer.id), dataToSave, { merge: true });
            } else {
                delete dataToSave.id;
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, customersCollectionPath), dataToSave);
            }
        } catch (error) { console.error("Error saving customer:", error); }
        closeFormModal();
    };

    const handleDeleteCustomer = (customerId) => {
        if (!db || !userId || !appId) return;
        showConfirmationModal('Supprimer Client', 'Sûr de vouloir supprimer ce client ?', async () => {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/customers`, customerId));
            } catch (error) { console.error("Error deleting customer:", error); }
        });
    };
    
    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );
    
    if (isLoading) return <div className="flex justify-center items-center h-full"><p>Chargement des clients...</p></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">Clients</h3>
                <button onClick={() => openFormModal()} className={`flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg w-full sm:w-auto`}>
                    <PlusCircle size={20} className="mr-2"/> Ajouter Client
                </button>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <input type="text" placeholder="Rechercher (Nom, Email, Tél)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"/>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto">
                <table className="min-w-full divide-y dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nom</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Téléphone</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Adresse</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y dark:divide-gray-700">
                        {filteredCustomers.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{c.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{c.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{c.phone}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 truncate max-w-xs" title={c.address}>{c.address}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onClick={() => openFormModal(c)} title="Modifier" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"><Edit2 size={18}/></button>
                                    <button onClick={() => handleDeleteCustomer(c.id)} title="Supprimer" className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredCustomers.length === 0 && !isLoading && (<p className="text-center py-8 text-gray-500 dark:text-gray-400">Aucun client trouvé.</p>)}
            </div>
            <CustomerFormModal isOpen={isFormModalOpen} onClose={closeFormModal} onSave={handleSaveCustomer} customer={editingCustomer} />
        </div>
    );
};

const SuppliersPage = ({ suppliers, setSuppliers, showConfirmationModal, db, userId, appId }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !userId || !appId) { setIsLoading(false); return; }
        setIsLoading(true);
        const suppliersCollectionPath = `artifacts/${appId}/users/${userId}/suppliers`;
        const q = query(collection(db, suppliersCollectionPath));
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const suppliersFromFirestore = [];
            querySnapshot.forEach((doc) => suppliersFromFirestore.push({ ...doc.data(), id: doc.id }));
            setSuppliers(suppliersFromFirestore.sort((a,b) => a.name.localeCompare(b.name)));
            setIsLoading(false);
        }, (error) => { console.error("Error fetching suppliers:", error); setIsLoading(false); });
        return () => unsubscribe();
    }, [db, userId, appId, setSuppliers]);

    const openFormModal = (supplier = null) => { setEditingSupplier(supplier); setIsFormModalOpen(true); };
    const closeFormModal = () => { setEditingSupplier(null); setIsFormModalOpen(false); };
    
    const handleSaveSupplier = async (supplierData) => {
        if (!db || !userId || !appId) return;
        const suppliersCollectionPath = `artifacts/${appId}/users/${userId}/suppliers`;
        const dataToSave = { ...supplierData, updatedAt: serverTimestamp() };
        try {
            if (editingSupplier && editingSupplier.id) {
                await setDoc(doc(db, suppliersCollectionPath, editingSupplier.id), dataToSave, { merge: true });
            } else {
                delete dataToSave.id;
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, suppliersCollectionPath), dataToSave);
            }
        } catch (error) { console.error("Error saving supplier:", error); }
        closeFormModal();
    };

    const handleDeleteSupplier = (supplierId) => {
        if (!db || !userId || !appId) return;
        showConfirmationModal('Supprimer Fournisseur', 'Sûr de vouloir supprimer ce fournisseur ?', async () => {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/suppliers`, supplierId));
            } catch (error) { console.error("Error deleting supplier:", error); }
        });
    };
    
    const filteredSuppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.includes(searchTerm)
    );

    if (isLoading) return <div className="flex justify-center items-center h-full"><p>Chargement des fournisseurs...</p></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">Fournisseurs</h3>
                <button onClick={() => openFormModal()} className={`flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg w-full sm:w-auto`}>
                    <PlusCircle size={20} className="mr-2"/> Ajouter Fournisseur
                </button>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <input type="text" placeholder="Rechercher (Nom, Email, Tél)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"/>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto">
                <table className="min-w-full divide-y dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nom</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Téléphone</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Adresse</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y dark:divide-gray-700">
                        {filteredSuppliers.map(s => (
                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{s.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{s.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{s.phone}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 truncate max-w-xs" title={s.address}>{s.address}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onClick={() => openFormModal(s)} title="Modifier" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"><Edit2 size={18}/></button>
                                    <button onClick={() => handleDeleteSupplier(s.id)} title="Supprimer" className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredSuppliers.length === 0 && !isLoading && (<p className="text-center py-8 text-gray-500 dark:text-gray-400">Aucun fournisseur trouvé.</p>)}
            </div>
            <SupplierFormModal isOpen={isFormModalOpen} onClose={closeFormModal} onSave={handleSaveSupplier} supplier={editingSupplier} />
        </div>
    );
};

const WarehousesPage = ({ warehouses, setWarehouses, showConfirmationModal, db, userId, appId }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !userId || !appId) { setIsLoading(false); return; }
        setIsLoading(true);
        const warehousesCollectionPath = `artifacts/${appId}/users/${userId}/warehouses`;
        const q = query(collection(db, warehousesCollectionPath));
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const warehousesFromFirestore = [];
            querySnapshot.forEach((doc) => warehousesFromFirestore.push({ ...doc.data(), id: doc.id }));
            setWarehouses(warehousesFromFirestore.sort((a,b) => a.name.localeCompare(b.name)));
            setIsLoading(false);
        }, (error) => { console.error("Error fetching warehouses:", error); setIsLoading(false); });
        return () => unsubscribe();
    }, [db, userId, appId, setWarehouses]);

    const openFormModal = (warehouse = null) => { setEditingWarehouse(warehouse); setIsFormModalOpen(true); };
    const closeFormModal = () => { setEditingWarehouse(null); setIsFormModalOpen(false); };

    const handleSaveWarehouse = async (warehouseData) => {
        if (!db || !userId || !appId) return;
        const warehousesCollectionPath = `artifacts/${appId}/users/${userId}/warehouses`;
        const dataToSave = { ...warehouseData, updatedAt: serverTimestamp() };
        try {
            if (editingWarehouse && editingWarehouse.id) {
                await setDoc(doc(db, warehousesCollectionPath, editingWarehouse.id), dataToSave, { merge: true });
            } else {
                delete dataToSave.id;
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, warehousesCollectionPath), dataToSave);
            }
        } catch (error) { console.error("Error saving warehouse:", error); }
        closeFormModal();
    };

    const handleDeleteWarehouse = (warehouseId) => {
        if (!db || !userId || !appId) return;
        showConfirmationModal('Supprimer Entrepôt', "Sûr de vouloir supprimer cet entrepôt ?", async () => {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/warehouses`, warehouseId));
            } catch (error) { console.error("Error deleting warehouse:", error); }
        });
    };

    const filteredWarehouses = warehouses.filter(w => 
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        w.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.manager?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return <div className="flex justify-center items-center h-full"><p>Chargement des entrepôts...</p></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">Entrepôts</h3>
                <button onClick={() => openFormModal()} className={`flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg w-full sm:w-auto`}>
                    <PlusCircle size={20} className="mr-2"/> Ajouter Entrepôt
                </button>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <input type="text" placeholder="Rechercher (Nom, Lieu, Responsable)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"/>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto">
                <table className="min-w-full divide-y dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nom</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Lieu</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Capacité</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Responsable</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y dark:divide-gray-700">
                        {filteredWarehouses.map(w => (
                            <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{w.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{w.location}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{w.capacity}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{w.manager}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onClick={() => openFormModal(w)} title="Modifier" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"><Edit2 size={18}/></button>
                                    <button onClick={() => handleDeleteWarehouse(w.id)} title="Supprimer" className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredWarehouses.length === 0 && !isLoading && (<p className="text-center py-8 text-gray-500 dark:text-gray-400">Aucun entrepôt trouvé.</p>)}
            </div>
            <WarehouseFormModal isOpen={isFormModalOpen} onClose={closeFormModal} onSave={handleSaveWarehouse} warehouse={editingWarehouse} />
        </div>
    );
};


const SettingsPage = ({ companyInfo, setCompanyInfo, db, userId, appId, showConfirmationModal }) => {
    const [formData, setFormData] = useState(companyInfo);
    const [isSaving, setIsSaving] = useState(false);
    const [logoPreview, setLogoPreview] = useState(companyInfo.logoUrl);

    useEffect(() => {
        setFormData(companyInfo);
        setLogoPreview(companyInfo.logoUrl);
    }, [companyInfo]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value) }));
    };
    
    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
                setFormData(prev => ({ ...prev, logoUrl: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!db || !userId || !appId) {
            showConfirmationModal("Erreur", "Connexion à la base de données non établie.", () => {});
            return;
        }
        setIsSaving(true);
        const companyInfoPath = `artifacts/${appId}/users/${userId}/companyInfo/details`;
        try {
            await setDoc(doc(db, companyInfoPath), formData, { merge: true });
            setCompanyInfo(formData); // Update local state immediately
            showConfirmationModal("Succès", "Informations de l'entreprise mises à jour.", () => {});
        } catch (error) {
            console.error("Error saving company info:", error);
            showConfirmationModal("Erreur", "Impossible de sauvegarder les informations.", () => {});
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">Paramètres de l'Entreprise</h3>
            
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom de l'entreprise</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" />
                    </div>
                     <div>
                        <label htmlFor="vatNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">N° TVA / Matricule Fiscal</label>
                        <input type="text" name="vatNumber" id="vatNumber" value={formData.vatNumber} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" />
                    </div>
                </div>

                <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Adresse</label>
                    <textarea name="address" id="address" value={formData.address} onChange={handleChange} rows="3" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Téléphone</label>
                        <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Devise par défaut</label>
                        <select name="currency" id="currency" value={formData.currency} onChange={handleChange} className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white">
                            <option value="TND">Dinar Tunisien (TND)</option>
                            <option value="EUR">Euro (€)</option>
                            <option value="USD">Dollar US ($)</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="defaultTaxRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Taux de TVA par défaut (%)</label>
                        <input type="number" name="defaultTaxRate" id="defaultTaxRate" value={(formData.defaultTaxRate || 0) * 100} onChange={(e) => setFormData(prev => ({...prev, defaultTaxRate: parseFloat(e.target.value)/100}))} step="0.1" min="0" max="100" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" />
                    </div>
                </div>
                 <div>
                    <label htmlFor="lowStockThreshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seuil de stock faible</label>
                    <input type="number" name="lowStockThreshold" id="lowStockThreshold" value={formData.lowStockThreshold} onChange={handleChange} min="0" className="mt-1 block w-full p-2.5 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" />
                </div>

                <div>
                    <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Logo de l'entreprise</label>
                    <div className="mt-2 flex items-center space-x-4">
                        {logoPreview ? (
                            <img src={logoPreview} alt="Aperçu Logo" className="h-24 w-auto max-w-xs object-contain rounded-md bg-gray-100 dark:bg-gray-700 p-1" />
                        ) : (
                            <div className="h-24 w-24 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md text-gray-400 dark:text-gray-500">
                                <ImageIcon size={40} />
                            </div>
                        )}
                        <input type="file" id="logoUrl" name="logoUrl" onChange={handleLogoChange} accept="image/*" className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800 cursor-pointer"/>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Format recommandé : PNG, JPG, SVG. Max 2Mo.</p>
                </div>

                <div className="pt-6 flex justify-end">
                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                        {isSaving ? 'Sauvegarde...' : "Sauvegarder Paramètres"}
                    </button>
                </div>
            </form>
        </div>
    );
};


const QuotesPage = ({ quotes, setQuotes, customers, products, companyInfo, showConfirmationModal, db, userId, appId }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false); 
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false); 
    const [editingQuote, setEditingQuote] = useState(null); 
    const [previewingQuote, setPreviewingQuote] = useState(null); 
    const [searchTerm, setSearchTerm] = useState(''); 
    const [filterStatus, setFilterStatus] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !userId || !appId) { setIsLoading(false); return; }
        setIsLoading(true);
        const quotesCollectionPath = `artifacts/${appId}/users/${userId}/quotes`;
        const q = query(collection(db, quotesCollectionPath));
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const quotesFromFirestore = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                quotesFromFirestore.push({ 
                    ...data, 
                    id: doc.id,
                    date: data.date instanceof Timestamp ? formatDateForInput(data.date) : data.date,
                    expiryDate: data.expiryDate instanceof Timestamp ? formatDateForInput(data.expiryDate) : data.expiryDate,
                });
            });
            setQuotes(quotesFromFirestore.sort((a,b) => new Date(b.date) - new Date(a.date)));
            setIsLoading(false);
        }, (error) => { console.error("Error fetching quotes:", error); setIsLoading(false); });
        return () => unsubscribe();
    }, [db, userId, appId, setQuotes]);

    const openFormModal = (quote = null) => { setEditingQuote(quote); setIsFormModalOpen(true); }; 
    const closeFormModal = () => { setEditingQuote(null); setIsFormModalOpen(false); };
    const openPreviewModal = (quote) => { setPreviewingQuote(quote); setIsPreviewModalOpen(true); }; 
    const closePreviewModal = () => { setPreviewingQuote(null); setIsPreviewModalOpen(false); };

    const handleSaveQuote = async (quoteData) => { 
        if (!db || !userId || !appId) { return; }
        const quotesCollectionPath = `artifacts/${appId}/users/${userId}/quotes`;
        const dataToSave = { 
            ...quoteData, 
            date: quoteData.date, 
            expiryDate: quoteData.expiryDate, 
            updatedAt: serverTimestamp() 
        };
        try {
            if (editingQuote && editingQuote.id) { 
                await setDoc(doc(db, quotesCollectionPath, editingQuote.id), dataToSave, { merge: true });
            } else { 
                delete dataToSave.id;
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, quotesCollectionPath), dataToSave);
            }
        } catch (error) { console.error("Error saving quote:", error); }
        closeFormModal(); 
    };
    const handleDeleteQuote = (quoteId) => { 
        if (!db || !userId || !appId) { return; }
        showConfirmationModal('Supprimer Devis', 'Sûr de vouloir supprimer ce devis ?', async () => {
            try {
                await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/quotes`, quoteId));
            } catch (error) { console.error("Error deleting quote:", error); }
        }); 
    };
    const filteredQuotes = quotes.filter(q => (q.id.toLowerCase().includes(searchTerm.toLowerCase()) || q.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) && (filterStatus === '' || q.status === filterStatus));
    
    if (isLoading) return <div className="flex justify-center items-center h-full"><p>Chargement des devis...</p></div>;
    return (<div className="space-y-6"><div className="flex flex-col sm:flex-row justify-between items-center gap-4"><h3 className="text-2xl font-semibold text-gray-800 dark:text-white">Devis</h3><button onClick={() => openFormModal()} className={`flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg w-full sm:w-auto`}><FilePlus size={20} className="mr-2" /> Nouveau Devis</button></div><div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-col sm:flex-row gap-4"><input type="text" placeholder="Rechercher (N°, Client)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-grow p-2 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"/><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="p-2 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white sm:w-auto"><option value="">Tous statuts</option>{quoteStatuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div><div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto"><table className="min-w-full divide-y dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">N° Devis</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Client</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expiration</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Statut</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y dark:divide-gray-700">{filteredQuotes.map(q => (<tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" onClick={() => openPreviewModal(q)}>{q.id}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">{q.customerName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatDateForInput(q.date)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatDateForInput(q.expiryDate)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white text-right font-semibold">{formatCurrency(q.totalAmount, companyInfo.currency)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-center"><span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${q.status === 'Accepté' || q.status === 'Facturé' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : q.status === 'Envoyé' || q.status === 'Brouillon' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' : q.status === 'Rejeté' || q.status === 'Annulé' ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'}`}>{q.status}</span></td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1"><button onClick={() => openPreviewModal(q)} title="Aperçu" className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 p-1"><Eye size={18} /></button><button onClick={() => openFormModal(q)} title="Modifier" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteQuote(q.id)} title="Supprimer" className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"><Trash2 size={18} /></button><button onClick={() => { setPreviewingQuote(q); setIsPreviewModalOpen(true); setTimeout(() => { const btn = document.getElementById('quote-print-button-modal'); if(btn) btn.click();}, 300);}} title="Imprimer" className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 p-1"><Printer size={18} /></button></td></tr>))}</tbody></table>{filteredQuotes.length === 0 && !isLoading && (<p className="text-center py-8 text-gray-500 dark:text-gray-400">Aucun devis.</p>)}</div><QuoteFormModal isOpen={isFormModalOpen} onClose={closeFormModal} onSave={handleSaveQuote} quote={editingQuote} customers={customers} products={products} companyInfo={companyInfo} /><QuotePreviewModal isOpen={isPreviewModalOpen} onClose={closePreviewModal} quote={previewingQuote} companyInfo={companyInfo} customers={customers}/></div>);
};

const InvoicesPage = ({ invoices, setInvoices, customers, products, /* setProducts, */ companyInfo, showConfirmationModal, db, userId, appId }) => { // Removed setProducts from props
    const [isFormModalOpen, setIsFormModalOpen] = useState(false); 
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false); 
    const [editingInvoice, setEditingInvoice] = useState(null); 
    const [previewingInvoice, setPreviewingInvoice] = useState(null); 
    const [searchTerm, setSearchTerm] = useState(''); 
    const [filterStatus, setFilterStatus] = useState('');
    const [isLoading, setIsLoading] = useState(true);


    useEffect(() => {
        if (!db || !userId || !appId) { setIsLoading(false); return; }
        setIsLoading(true);
        const invoicesCollectionPath = `artifacts/${appId}/users/${userId}/invoices`;
        const q = query(collection(db, invoicesCollectionPath));
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const invoicesFromFirestore = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                invoicesFromFirestore.push({ 
                    ...data, 
                    id: doc.id,
                    date: data.date instanceof Timestamp ? formatDateForInput(data.date) : data.date,
                    dueDate: data.dueDate instanceof Timestamp ? formatDateForInput(data.dueDate) : data.dueDate,
                    paymentDate: data.paymentDate ? (data.paymentDate instanceof Timestamp ? formatDateForInput(data.paymentDate) : data.paymentDate) : null,
                });
            });
            setInvoices(invoicesFromFirestore.sort((a,b) => new Date(b.date) - new Date(a.date)));
            setIsLoading(false);
        }, (error) => { console.error("Error fetching invoices:", error); setIsLoading(false); });
        return () => unsubscribe();
    }, [db, userId, appId, setInvoices]);


    const openFormModal = (invoice = null) => { 
        setEditingInvoice(invoice); 
        setIsFormModalOpen(true); 
    }; 
    const closeFormModal = () => { 
        setEditingInvoice(null); 
        setIsFormModalOpen(false); 
    };

    const openPreviewModal = (invoice) => { 
        setPreviewingInvoice(invoice); 
        setIsPreviewModalOpen(true); 
    }; 
    const closePreviewModal = () => { 
        setPreviewingInvoice(null); 
        setIsPreviewModalOpen(false); 
    };

    const handleSaveInvoice = async (invoiceData) => {
        if (!db || !userId || !appId) {
            showConfirmationModal("Erreur", "Connexion à la base de données non établie.", () => {});
            return;
        }
        const invoicesCollectionPath = `artifacts/${appId}/users/${userId}/invoices`;
        const productsCollectionPath = `artifacts/${appId}/users/${userId}/products`;
        const batch = writeBatch(db);
        
        let currentProductsState = JSON.parse(JSON.stringify(products));

        const originalInvoiceItems = editingInvoice ? editingInvoice.items : [];
        const newInvoiceItems = invoiceData.items;

        const stockChanges = {};

        originalInvoiceItems.forEach(item => {
            stockChanges[item.productId] = (stockChanges[item.productId] || 0) + Number(item.quantity);
        });
        newInvoiceItems.forEach(item => {
            stockChanges[item.productId] = (stockChanges[item.productId] || 0) - Number(item.quantity);
        });

        for (const productId in stockChanges) {
            if (stockChanges[productId] !== 0) {
                const productDocRef = doc(db, productsCollectionPath, productId);
                const productIndex = currentProductsState.findIndex(p => p.id === productId);
                if (productIndex !== -1 && currentProductsState[productIndex].stock !== Infinity) {
                    let newStock = (currentProductsState[productIndex].stock || 0) + stockChanges[productId];
                    if (newStock < 0) {
                        showConfirmationModal("Stock Insuffisant", `Stock insuffisant pour le produit ${currentProductsState[productIndex].name}. Opération annulée.`, () => {});
                        return; 
                    }
                    batch.update(productDocRef, { stock: newStock });
                }
            }
        }
        
        const dataToSave = {
            ...invoiceData,
            date: invoiceData.date, 
            dueDate: invoiceData.dueDate,
            paymentDate: invoiceData.paymentDate ? invoiceData.paymentDate : null,
            updatedAt: serverTimestamp()
        };

        try {
            if (editingInvoice && editingInvoice.id) {
                const invoiceDocRef = doc(db, invoicesCollectionPath, editingInvoice.id);
                batch.set(invoiceDocRef, dataToSave, { merge: true });
            } else {
                delete dataToSave.id;
                dataToSave.createdAt = serverTimestamp();
                const newInvoiceRef = doc(collection(db, invoicesCollectionPath));
                batch.set(newInvoiceRef, dataToSave);
            }
            await batch.commit();
        } catch (error) {
            console.error("Error saving invoice/updating stock: ", error);
            showConfirmationModal("Erreur", "Impossible de sauvegarder la facture ou de mettre à jour le stock.", () => {});
        }
        closeFormModal(); 
    };

    const handleDeleteInvoice = async (invoiceId) => { 
      if (!db || !userId || !appId) { return; }
      const invoiceToDelete = invoices.find(inv => inv.id === invoiceId);
      if (invoiceToDelete) {
        showConfirmationModal('Supprimer Facture', 'Sûr de vouloir supprimer cette facture ? Le stock sera réajusté.', async () => {
            const batch = writeBatch(db);
            const productsCollectionPath = `artifacts/${appId}/users/${userId}/products`;
            
            invoiceToDelete.items.forEach(item => {
                const productDocRef = doc(db, productsCollectionPath, item.productId);
                const product = products.find(p => p.id === item.productId);
                if (product && product.stock !== Infinity) {
                    batch.update(productDocRef, { stock: (product.stock || 0) + Number(item.quantity) });
                }
            });
            
            const invoiceDocRef = doc(db, `artifacts/${appId}/users/${userId}/invoices`, invoiceId);
            batch.delete(invoiceDocRef);

            try {
                await batch.commit();
            } catch (error) {
                console.error("Error deleting invoice/reverting stock: ", error);
                showConfirmationModal("Erreur", "Impossible de supprimer la facture ou de réajuster le stock.", () => {});
            }
        }); 
      }
    };
    
    const filteredInvoices = Array.isArray(invoices) ? invoices.filter(inv => {
        const searchTermLower = searchTerm.toLowerCase();
        const idMatch = inv && typeof inv.id === 'string' && inv.id.toLowerCase().includes(searchTermLower);
        const customerNameMatch = inv && typeof inv.customerName === 'string' && inv.customerName.toLowerCase().includes(searchTermLower);
        const statusMatch = filterStatus === '' || inv.status === filterStatus;
        return (idMatch || customerNameMatch) && statusMatch;
    }) : [];
    
    if (isLoading) return <div className="flex justify-center items-center h-full"><p>Chargement des factures...</p></div>;
    return (<div className="space-y-6"><div className="flex flex-col sm:flex-row justify-between items-center gap-4"><h3 className="text-2xl font-semibold text-gray-800 dark:text-white">Factures</h3><button onClick={() => openFormModal()} className={`flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg w-full sm:w-auto`}><FilePlus size={20} className="mr-2" /> Nouvelle Facture</button></div><div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-col sm:flex-row gap-4"><input type="text" placeholder="Rechercher (N°, Client)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-grow p-2 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"/><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="p-2 border dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white sm:w-auto"><option value="">Tous statuts</option>{invoiceStatuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div><div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-x-auto"><table className="min-w-full divide-y dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">N° Facture</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Client</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Échéance</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Statut</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y dark:divide-gray-700">{filteredInvoices.map(inv => (<tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer" onClick={() => openPreviewModal(inv)}>{inv.id}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">{inv.customerName}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatDateForInput(inv.date)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatDateForInput(inv.dueDate)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-white text-right font-semibold">{formatCurrency(inv.totalAmount, companyInfo.currency)}</td><td className="px-6 py-4 whitespace-nowrap text-sm text-center"><span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${inv.status === 'Payée' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : inv.status === 'En attente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' : inv.status === 'En retard' ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100'}`}>{inv.status}</span></td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1"><button onClick={() => openPreviewModal(inv)} title="Aperçu" className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 p-1"><Eye size={18} /></button><button onClick={() => openFormModal(inv)} title="Modifier" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"><Edit2 size={18} /></button><button onClick={() => handleDeleteInvoice(inv.id)} title="Supprimer" className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"><Trash2 size={18} /></button><button onClick={() => { setPreviewingInvoice(inv); setIsPreviewModalOpen(true); setTimeout(() => { const btn = document.getElementById('invoice-print-button-modal'); if(btn) btn.click();}, 300);}} title="Imprimer" className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 p-1"><Printer size={18} /></button></td></tr>))}</tbody></table>{filteredInvoices.length === 0 && !isLoading && (<p className="text-center py-8 text-gray-500 dark:text-gray-400">Aucune facture.</p>)}</div><InvoiceFormModal isOpen={isFormModalOpen} onClose={closeFormModal} onSave={handleSaveInvoice} invoice={editingInvoice} customers={customers} products={products} companyInfo={companyInfo} /><InvoicePreviewModal isOpen={isPreviewModalOpen} onClose={closePreviewModal} invoice={previewingInvoice} companyInfo={companyInfo} customers={customers} /></div>);
};

// Main App Component
export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [companyInfo, setCompanyInfo] = useState(defaultCompanyInfo); 
  const [customers, setCustomers] = useState([]); 
  const [suppliers, setSuppliers] = useState([]); 
  const [products, setProducts] = useState([]); 
  const [warehouses, setWarehouses] = useState([]); 
  const [invoices, setInvoices] = useState([]); 
  const [quotes, setQuotes] = useState([]); 
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [auth, setAuth] = useState(null); 
  const [db, setDb] = useState(null); 
  const [appId, setAppId] = useState(null);


  const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {},});
  const showConfirmationModal = (title, message, onConfirm) => { setConfirmationModal({ isOpen: true, title, message, onConfirm });};
  const hideConfirmationModal = () => { setConfirmationModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });};

  useEffect(() => { 
    if (darkMode) { 
      document.documentElement.classList.add('dark'); 
    } else { 
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Firebase Initialization and Auth State Listener
  useEffect(() => {
    setLogLevel('debug'); 
    let unsubscribeAuth;
    
    const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'factupro-app'; 
    setAppId(currentAppId);
    console.log("Using App ID:", currentAppId);

    let firebaseConfigToUse;
    const fallbackFirebaseConfig = {
        apiKey: "AIzaSyAh-Bv2LA6kruAjI2PRaZ1V3eyCq1isH_c", // Replace with your actual API key if needed for fallback
        authDomain: "facturationprobase-6bff5.firebaseapp.com",
        projectId: "facturationprobase-6bff5",
        storageBucket: "facturationprobase-6bff5.appspot.com",
        messagingSenderId: "458922659831",
        appId: "1:458922659831:web:89ad59fa900ffa0a3728f2",
        measurementId: "G-LQ08NYHZ5C"
    };

    try {
        if (typeof __firebase_config !== 'undefined' && typeof __firebase_config === 'string' && __firebase_config.trim() !== "") {
            firebaseConfigToUse = JSON.parse(__firebase_config);
            console.log("Using global __firebase_config for Firebase initialization.");
        } else {
            firebaseConfigToUse = fallbackFirebaseConfig;
            console.warn("Global __firebase_config not found or invalid. Using hardcoded fallback Firebase config. THIS IS NOT SUITABLE FOR PRODUCTION.");
        }
        
        if (!firebaseConfigToUse || !firebaseConfigToUse.apiKey) {
            console.error("Firebase configuration is invalid or missing. Firebase cannot be initialized.");
            setAuthLoading(false);
            return;
        }

        const app = getApps().length === 0 ? initializeApp(firebaseConfigToUse) : getApp();
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);
        
        setAuth(authInstance);
        setDb(dbInstance);

        // Attempt to enable persistence only if it hasn't been enabled before for this db instance
        if (dbInstance && !dbInstance._persistenceKey) { // _persistenceKey is an internal detail, but can indicate if persistence was attempted
            enableIndexedDbPersistence(dbInstance, {cacheSizeBytes: CACHE_SIZE_UNLIMITED})
            .then(() => console.log("Firebase offline persistence enabled."))
            .catch((err) => { 
                if (err.code === 'failed-precondition') {
                    console.warn("Firebase offline persistence failed: Multiple tabs open or other issues. Data will not be available offline.");
                } else if (err.code === 'unimplemented') {
                     console.warn("Firebase offline persistence failed: Browser does not support it.");
                } else {
                    console.error("Firebase offline persistence failed: ", err); 
                }
            });
        }


        unsubscribeAuth = onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                setCurrentUser(user);
                console.log("User signed in:", user.uid);
            } else {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    try {
                        await signInWithCustomToken(authInstance, __initial_auth_token);
                    } catch (error) { console.error("Error signing in with custom token:", error); setCurrentUser(null); }
                } else { setCurrentUser(null); console.log("No user signed in, and no custom token provided."); }
            }
            setAuthLoading(false);
        });
    } catch (error) { console.error("Error initializing Firebase:", error); setAuthLoading(false); }
    
    return () => { if (unsubscribeAuth) unsubscribeAuth(); };
  }, []);

  // Fetch Company Info
   useEffect(() => {
        if (!db || !currentUser || !appId) return;
        const companyInfoPath = `artifacts/${appId}/users/${currentUser.uid}/companyInfo/details`;
        const unsub = onSnapshot(doc(db, companyInfoPath), async (docSnap) => {
            if (docSnap.exists()) {
                setCompanyInfo(prev => ({...prev, ...docSnap.data()}));
            } else {
                console.log("No company info found, setting default and saving to Firestore.");
                try {
                    await setDoc(doc(db, companyInfoPath), defaultCompanyInfo);
                    setCompanyInfo(defaultCompanyInfo); 
                } catch (error) {
                    console.error("Error seeding company info:", error);
                }
            }
        }, error => console.error("Error fetching company info:", error));
        return () => unsub();
    }, [db, currentUser, appId]);


  const handleGoogleLogin = async () => { 
    if (!auth) {
        console.error("Firebase Auth not initialized for Google Login.");
        showConfirmationModal("Erreur d'Authentification", "Le service d'authentification n'est pas prêt. Veuillez réessayer.", () => {});
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error during Google Sign-In:", error);
        let message = "La connexion avec Google a échoué. Veuillez réessayer.";
        if (error.code === 'auth/popup-closed-by-user') {
            message = "La fenêtre de connexion Google a été fermée avant la fin.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            message = "Une autre fenêtre de connexion est déjà ouverte.";
        } else if (error.code === 'auth/popup-blocked') {
            message = "La fenêtre de connexion Google a été bloquée par le navigateur. Veuillez autoriser les pop-ups pour ce site.";
        }
        showConfirmationModal("Erreur de Connexion", message, () => {});
    }
  };
  const handleLogout = async () => { 
    if (!auth) {
        console.error("Firebase Auth not initialized for Logout.");
        return;
    }
    try {
        await signOut(auth);
        setCurrentPage('dashboard'); 
    } catch (error) {
        console.error("Error signing out:", error);
    }
   };
  const toggleDarkMode = () => setDarkMode(!darkMode);
  const handleNavigation = (page) => { setCurrentPage(page); setOpenDropdown(null); };
  const toggleDropdown = (dropdown) => { setOpenDropdown(openDropdown === dropdown ? null : dropdown);};
  
  const lowStockThreshold = companyInfo.lowStockThreshold || 10;
  const lowStockProductsCount = products.filter(p => p.stock !== Infinity && p.stock < lowStockThreshold).length;

  const NavItem = ({ icon, label, page, subItems, isBottom = false, notificationCount = 0 }) => {
    const IconComponent = icon;
    const isSelected = currentPage === page || (subItems && subItems.some(sub => sub.page === currentPage));
    const hasSubItems = subItems && subItems.length > 0;

    return (
        <li className={`${isBottom ? '' : 'mb-1'} relative`}>
            <button
                onClick={() => hasSubItems ? toggleDropdown(page) : handleNavigation(page)}
                className={`w-full flex items-center justify-between py-2.5 px-4 rounded-lg transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700'}`}
            >
                <div className="flex items-center"> 
                    <IconComponent size={20} className="mr-3 flex-shrink-0" />
                    {isSidebarOpen && (
                        <>
                            <span>{label}</span>
                            {notificationCount > 0 && (
                                <span
                                    className="ml-2 h-5 min-w-[1.25rem] px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center"
                                    title={`${notificationCount} ${label === 'Catalogue' ? 'produit(s) en stock faible' : 'notifications'}`}
                                >
                                    {notificationCount}
                                </span>
                            )}
                        </>
                    )}
                    {!isSidebarOpen && !isBottom && <span className="sr-only">{label}</span>}
                </div>
                {hasSubItems && isSidebarOpen && <ChevronDown size={18} className={`transform transition-transform ${openDropdown === page ? 'rotate-180' : ''}`} />}
            </button>

            {!isSidebarOpen && notificationCount > 0 && (
                <span
                    className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full pointer-events-none border-2 border-white dark:border-gray-800"
                    title={`${notificationCount} ${label === 'Catalogue' ? 'produit(s) en stock faible' : 'notifications'}`}
                >
                </span>
            )}

            {hasSubItems && openDropdown === page && isSidebarOpen && (
                <ul className="pl-8 mt-1 space-y-1">
                    {subItems.map(subItem => (
                        <li key={subItem.page}>
                            <button
                                onClick={() => handleNavigation(subItem.page)}
                                className={`w-full text-left py-2 px-3 rounded-md text-sm transition-colors ${currentPage === subItem.page ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-600'}`}
                            >
                                {subItem.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
  };

  const renderPage = () => {
    const commonProps = { companyInfo, showConfirmationModal, hideConfirmationModal, db, userId: currentUser?.uid, appId };
    const pageProps = {
        ...commonProps,
        customers, setCustomers,
        suppliers, setSuppliers,
        products, setProducts,
        warehouses, setWarehouses,
        invoices, setInvoices,
        quotes, setQuotes,
    };

    switch (currentPage) {
      case 'dashboard': return <DashboardPage {...pageProps} />;
      case 'invoices': return <InvoicesPage {...pageProps} />; // setProducts is not passed here intentionally
      case 'quotes': return <QuotesPage {...pageProps} />;
      case 'products': return <ProductsPage {...pageProps} />;
      case 'customers': return <CustomersPage {...pageProps} />;
      case 'suppliers': return <SuppliersPage {...pageProps} />;
      case 'warehouses': return <WarehousesPage {...pageProps} />;
      case 'settings': return <SettingsPage companyInfo={companyInfo} setCompanyInfo={setCompanyInfo} db={db} userId={currentUser?.uid} appId={appId} showConfirmationModal={showConfirmationModal}/>;
      default: return <DashboardPage {...pageProps} />;
    }
  };

  if (authLoading || (!db && currentUser)) { 
    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
            <div className="text-center">
                <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Chargement de l'application...</p>
            </div>
        </div>
    );
  }

  if (!currentUser) {
    return (
        <div className={`flex flex-col items-center justify-center h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
            <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl text-center max-w-md w-full">
                <Building size={48} className="mx-auto text-blue-600 dark:text-blue-400 mb-6" />
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-3">Bienvenue sur FactuPro</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-8">Veuillez vous connecter pour accéder à votre espace de gestion commerciale.</p>
                <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors"
                >
                    <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48px" height="48px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                    Se connecter avec Google
                </button>
            </div>
             <footer className="absolute bottom-4 text-center w-full text-xs text-gray-500 dark:text-gray-400">
                <p>Assurez-vous d'avoir configuré Firebase et activé Google Sign-In dans votre projet Firebase.</p>
                 <p>La variable <code>__firebase_config</code> doit être définie globalement avec votre configuration Firebase.</p>
            </footer>
        </div>
    );
  }

  // If currentUser exists, render the main application
  return (
    <div className={`flex h-screen bg-gray-100 dark:bg-gray-900 font-sans`}>
      <aside className={`bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'w-64' : 'w-20'} p-4`}>
        <div className="flex items-center justify-between mb-6">{isSidebarOpen && (<h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">FactuPro</h1>)}<button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700">{isSidebarOpen ? <X size={20} /> : <Layers size={20} />}</button></div>
        <nav className="flex-grow"><ul>
            <NavItem icon={Home} label="Tableau de Bord" page="dashboard" />
            <NavItem icon={FileText} label="Ventes" page="sales" subItems={[
              { label: 'Factures', page: 'invoices' },
              { label: 'Devis', page: 'quotes' },
            ]} />
             <NavItem icon={ShoppingCart} label="Achats" page="purchases" subItems={[{ label: 'Fournisseurs', page: 'suppliers' },]} />
            <NavItem 
                icon={Package} 
                label="Catalogue" 
                page="catalog" 
                subItems={[
                    { label: 'Produits', page: 'products' },
                    { label: 'Entrepôts', page: 'warehouses' },
                ]}
                notificationCount={lowStockProductsCount} 
            />
            <NavItem icon={Users} label="Clients" page="customers" />
        </ul></nav>
        <div className="mt-auto space-y-2">{isSidebarOpen && (<ul className="mb-2"> <NavItem icon={Settings} label="Paramètres" page="settings" isBottom={true}/></ul>)}{!isSidebarOpen && (<ul className="mb-2"><NavItem icon={Settings} label="Paramètres" page="settings" isBottom={true}/></ul>)}<div className="border-t border-gray-200 dark:border-gray-700 pt-3">{isSidebarOpen ? (<div className="flex items-center space-x-3">{companyInfo.logoUrl ? (<img src={companyInfo.logoUrl} alt="Logo Entreprise" className="h-16 w-16 object-contain rounded-md flex-shrink-0" onError={(e) => {e.target.src='https://placehold.co/64x64/e2e8f0/94a3b8?text=Logo'; e.target.alt="Placeholder Logo";}} />) : (<div className="h-16 w-16 flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-md flex-shrink-0"><Building size={32}/></div>)}<p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={companyInfo.name}>{companyInfo.name}</p></div>) : (companyInfo.logoUrl ? (<img src={companyInfo.logoUrl} alt="Logo" className="h-10 w-10 mx-auto object-contain rounded-md" onError={(e) => {e.target.src='https://placehold.co/40x40/e2e8f0/94a3b8?text=L'; e.target.alt="P. Logo";}} />) : (<div className="h-10 w-10 flex items-center justify-center text-gray-400 dark:text-gray-500 mx-auto"><Building size={24}/></div>) )}</div></div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">{currentPage.charAt(0).toUpperCase() + currentPage.slice(1).replace('-', ' ').replace('notes', 'Notes').replace('avoir', "d'Avoir")}</h2>
            <div className="flex items-center space-x-4">
                <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
                <div className="relative">
                    <div className="flex items-center space-x-2">
                        {currentUser.photoURL ? (
                            <img src={currentUser.photoURL} alt={currentUser.displayName || "Utilisateur"} className="w-8 h-8 rounded-full" />
                        ) : (
                            <UserCircle size={24} className="text-gray-600 dark:text-gray-300" />
                        )}
                        {isSidebarOpen && <span className="hidden md:inline text-sm text-gray-700 dark:text-gray-300">{currentUser.displayName || currentUser.email}</span>}
                        <button onClick={handleLogout} title="Déconnexion" className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-700/50 text-red-600 dark:text-red-400">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </header>
        <div className="flex-1 p-6 overflow-auto">{renderPage()}</div>
      </main>
      <ConfirmationModal isOpen={confirmationModal.isOpen} onClose={hideConfirmationModal} onConfirm={confirmationModal.onConfirm} title={confirmationModal.title} message={confirmationModal.message} />
    </div>
  );
}
