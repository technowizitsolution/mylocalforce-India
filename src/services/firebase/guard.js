import { auth } from './firebaseConfig';

/**
 * checkAuthAndRedirect
 * - actionFunction: async function to perform when authenticated
 * - navigate: react-router-dom navigate function (from useNavigate())
 * - redirectTo: route to return to after login (string)
 *
 * If not authenticated, navigates to '/login' and passes redirectTo via state
 */
export async function checkAuthAndRedirect(actionFunction, navigate, redirectTo) {
  const user = auth.currentUser;
  if (!user) {
    // navigate to login page; pass redirectTo via location state
    navigate('/login', { state: { redirectTo }, replace: true });
    return null;
  }
  return await actionFunction();
}
