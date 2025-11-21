import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CartItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  imageUrl: string;
  quantity: number;
  source: 'arthur' | 'shop' | 'promotion';
  reason?: string;
  productId?: string;
  cartId?: string;
}

interface Cart {
  id: string;
  pharmacyId: string | null;
  pharmacyName?: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  items: CartItem[];
}

interface CartContextType {
  activeCarts: Cart[];
  cartHistory: Cart[];
  selectedPharmacyId: string | null;
  addToCart: (product: Omit<CartItem, 'quantity'>, pharmacyId?: string) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: (cartId: string) => Promise<void>;
  deleteCart: (cartId: string) => Promise<void>;
  completeCart: (cartId: string) => Promise<void>;
  totalItems: number;
  totalPrice: number;
  loadCarts: () => Promise<void>;
  setSelectedPharmacyId: (id: string | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [activeCarts, setActiveCarts] = useState<Cart[]>([]);
  const [cartHistory, setCartHistory] = useState<Cart[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Charger l'utilisateur initial
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        loadSelectedPharmacy();
        loadCarts();
      }
    });

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Utilisateur connecté - charger les données
        loadSelectedPharmacy();
        loadCarts();
      } else {
        // Utilisateur déconnecté - réinitialiser tout
        setActiveCarts([]);
        setCartHistory([]);
        setSelectedPharmacyId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadSelectedPharmacy = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Charger la première pharmacie référente (pharmacie initiale)
      const { data } = await supabase
        .from('user_pharmacy_affiliation')
        .select('pharmacy_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSelectedPharmacyId(data.pharmacy_id);
      }
    } catch (error) {
      console.error('Error loading selected pharmacy:', error);
    }
  };

  const loadCarts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load all carts with their items
      const { data: cartsData, error: cartsError } = await supabase
        .from('carts')
        .select(`
          id,
          pharmacy_id,
          status,
          created_at,
          updated_at,
          completed_at,
          pharmacies (
            name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (cartsError) throw cartsError;

      // Load all cart items
      const { data: itemsData, error: itemsError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', user.id);

      if (itemsError) throw itemsError;

      // Organize data into Cart objects
      const carts: Cart[] = (cartsData || []).map(cart => ({
        id: cart.id,
        pharmacyId: cart.pharmacy_id,
        pharmacyName: (cart.pharmacies as any)?.name,
        status: cart.status as 'active' | 'completed' | 'cancelled',
        createdAt: cart.created_at,
        updatedAt: cart.updated_at,
        completedAt: cart.completed_at || undefined,
        items: (itemsData || [])
          .filter(item => item.cart_id === cart.id)
          .map(item => ({
            id: item.id,
            name: item.product_name,
            brand: item.brand,
            price: Number(item.price),
            imageUrl: item.image_url || '',
            quantity: item.quantity,
            source: item.source as 'arthur' | 'shop',
            reason: item.reason || undefined,
            productId: item.product_id || undefined,
          })),
      }));

      setActiveCarts(carts.filter(c => c.status === 'active'));
      setCartHistory(carts.filter(c => c.status !== 'active'));

      // Auto-sélectionner la pharmacie référente si aucune n'est définie
      if (!selectedPharmacyId) {
        const firstPharmacyCart = carts.find(c => c.pharmacyId);
        if (firstPharmacyCart?.pharmacyId) {
          setSelectedPharmacyId(firstPharmacyCart.pharmacyId);
        }
      }
    } catch (error) {
      console.error('Error loading carts:', error);
    }
  };

  const getOrCreateCart = async (pharmacyId?: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Find existing active cart for this pharmacy
    const existingCart = activeCarts.find(c => c.pharmacyId === pharmacyId);
    if (existingCart) return existingCart.id;

    // Create new cart
    const { data, error } = await supabase
      .from('carts')
      .insert({
        user_id: user.id,
        pharmacy_id: pharmacyId || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    await loadCarts();
    return data.id;
  };

  const addToCart = async (product: Omit<CartItem, 'quantity'>, pharmacyId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cartId = await getOrCreateCart(pharmacyId);

      // Check if item already exists in this cart
      const cart = [...activeCarts, ...cartHistory].find(c => c.id === cartId);
      const existingItem = cart?.items.find(item =>
        (product.productId && item.productId === product.productId) ||
        (!product.productId && item.source === product.source && item.name === product.name && item.reason === product.reason)
      );

      if (existingItem) {
        // Update quantity
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        // Insert new item
        const isUuid = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(product.productId || '');
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            cart_id: cartId,
            product_id: isUuid ? product.productId : null,
            product_name: product.name,
            brand: product.brand,
            price: product.price,
            image_url: product.imageUrl,
            quantity: 1,
            source: product.source,
            reason: product.reason,
          });

        if (error) throw error;
      }

      await loadCarts();
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      await loadCarts();
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);

      if (error) throw error;
      await loadCarts();
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const clearCart = async (cartId: string) => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cartId);

      if (error) throw error;
      await loadCarts();
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  };

  const deleteCart = async (cartId: string) => {
    try {
      // Delete all items first
      const { error: itemsError } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cartId);

      if (itemsError) throw itemsError;

      // Then delete the cart
      const { error: cartError } = await supabase
        .from('carts')
        .delete()
        .eq('id', cartId);

      if (cartError) throw cartError;
      await loadCarts();
    } catch (error) {
      console.error('Error deleting cart:', error);
    }
  };

  const completeCart = async (cartId: string) => {
    try {
      const { error } = await supabase
        .from('carts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', cartId);

      if (error) throw error;
      await loadCarts();
    } catch (error) {
      console.error('Error completing cart:', error);
    }
  };

  // Filtrer les paniers par pharmacie sélectionnée
  const filteredCarts = selectedPharmacyId 
    ? activeCarts.filter(cart => cart.pharmacyId === selectedPharmacyId)
    : activeCarts;

  // Retourner 0 si l'utilisateur n'est pas connecté
  const totalItems = user ? filteredCarts.reduce((sum, cart) =>
    sum + cart.items.reduce((s, item) => s + item.quantity, 0), 0
  ) : 0;
  
  const totalPrice = user ? filteredCarts.reduce((sum, cart) =>
    sum + cart.items.reduce((s, item) => s + item.price * item.quantity, 0), 0
  ) : 0;

  return (
    <CartContext.Provider
      value={{
        activeCarts,
        cartHistory,
        selectedPharmacyId,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        deleteCart,
        completeCart,
        totalItems,
        totalPrice,
        loadCarts,
        setSelectedPharmacyId,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
