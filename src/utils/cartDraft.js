const CART_DRAFT_KEY = 'mylocalforce.cartDraft.v1';

export const saveCartDraft = (draft) => {
  if (!draft?.serviceData) return;

  try {
    window.localStorage.setItem(
      CART_DRAFT_KEY,
      JSON.stringify({
        ...draft,
        savedAt: Date.now(),
      })
    );
  } catch (error) {
    console.warn('Could not save cart draft', error);
  }
};

export const getCartDraft = () => {
  try {
    const raw = window.localStorage.getItem(CART_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Could not read cart draft', error);
    return null;
  }
};

export const clearCartDraft = () => {
  try {
    window.localStorage.removeItem(CART_DRAFT_KEY);
  } catch (error) {
    console.warn('Could not clear cart draft', error);
  }
};
