import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, firestore } from '../services/firebase/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
  loginWithEmail, 
  signUpWithEmailPassword, 
  signOutUser,
  fetchUserRoles,
  fetchUserProfile
} from '../services/firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [userRoles, setUserRoles] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let userDocUnsubscribe = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user profile and roles initially
          const [profile, rolesData] = await Promise.all([
            fetchUserProfile(firebaseUser.uid).catch(() => null),
            fetchUserRoles(firebaseUser.uid).catch(() => ({ roles: {}, activeRole: null }))
          ]);

          const userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            emailVerified: firebaseUser.emailVerified,
            phoneNumber: firebaseUser.phoneNumber,
            ...(profile || {})
          };

          // Check approval status for clients
          const approvalStatus = profile?.approvalStatus || 'approved';
          const hasClientRole = rolesData?.roles?.client === true;
          
          // Only reject completely rejected accounts
          if (hasClientRole && approvalStatus === 'rejected') {
            await signOut(auth);
            setUser(null);
            setUserRoles(null);
            setActiveRole(null);
            setIsLoggedIn(false);
            return;
          }

          const resolvedActiveRole =
            rolesData.activeRole || profile?.activeRole || null;

          setUser(userData);
          setUserRoles({
            ...rolesData,
            activeRole: resolvedActiveRole,
          });
          setActiveRole(resolvedActiveRole);
          setIsLoggedIn(true);

          // Set up real-time listener for user document updates
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          userDocUnsubscribe = onSnapshot(
            userDocRef,
            (docSnapshot) => {
              if (docSnapshot.exists()) {
                const updatedData = docSnapshot.data();
                console.log('👤 User document updated in real-time:', updatedData);
                
                const nextRoles = updatedData.roles || {};
                const nextActiveRole =
                  updatedData.activeRole ||
                  Object.keys(nextRoles).find((role) => nextRoles[role]) ||
                  null;

                // Update user and role state with new data.
                setUser(prevUser => ({
                  ...prevUser,
                  ...updatedData,
                }));

                setUserRoles((prevRoles) => ({
                  ...(prevRoles || {}),
                  roles:
                    Object.keys(nextRoles).length > 0
                      ? nextRoles
                      : prevRoles?.roles || {},
                  activeRole: nextActiveRole || prevRoles?.activeRole || null,
                }));

                if (nextActiveRole) {
                  setActiveRole(nextActiveRole);
                }
              }
            },
            (error) => {
              console.error('Error listening to user document:', error);
            }
          );

        } catch (error) {
          console.error('Error fetching user data:', error);
          const userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            emailVerified: firebaseUser.emailVerified,
            phoneNumber: firebaseUser.phoneNumber,
          };
          setUser(userData);
          setUserRoles({ roles: {}, activeRole: null });
          setActiveRole(null);
          setIsLoggedIn(true);
        }
      } else {
        setUser(null);
        setUserRoles(null);
        setActiveRole(null);
        setIsLoggedIn(false);
        
        // Clean up user document listener
        if (userDocUnsubscribe) {
          userDocUnsubscribe();
          userDocUnsubscribe = null;
        }
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
      }
    };
  }, []);

  const login = async (email, password) => {
    try {
      const result = await loginWithEmail(email, password);
      // loginWithEmail returns a user object on success
      if (result && result.uid) {
        // Check approval status for the user
        const profile = await fetchUserProfile(result.uid).catch(() => null);
        const rolesData = await fetchUserRoles(result.uid).catch(() => ({ roles: {} }));
        
        const approvalStatus = profile?.approvalStatus || 'approved';
        const hasClientRole = rolesData?.roles?.client === true;
        
        // Only block rejected accounts from logging in
        // Pending accounts can login but will be redirected to ProfileUnderReview screen
        if (hasClientRole && approvalStatus === 'rejected') {
          await signOut(auth);
          return { 
            success: false, 
            error: 'Account Not Approved\n\nYour service provider application has been rejected. Please contact our support team for more information.' 
          };
        }
        
        // Store approval status for navigation handling
        if (hasClientRole && approvalStatus === 'pending') {
          return { success: true, approvalStatus: 'pending' };
        }
        
        return { success: true };
      } else {
        return { success: false, error: 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed';
      
      // Handle specific Firebase auth errors
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  };

  const register = async (userData) => {
    try {
      // Determine the primary role from selectedRoles
      const selectedRoles = userData.selectedRoles || { customer: true };
      const primaryRole = Object.keys(selectedRoles).find(role => selectedRoles[role]) || 'customer';
      
      const result = await signUpWithEmailPassword(
        userData.email,
        userData.password,
        userData.profile || {},
        primaryRole
      );
      
      if (result.success) {
        return { success: true };
      } else if (result.existing) {
        return { success: false, error: 'User already exists. Please login instead.' };
      } else {
        return { success: false, error: 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed';
      
      // Handle specific Firebase auth errors
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const refreshUserData = async () => {
    if (user?.uid) {
      try {
        const [profile, rolesData] = await Promise.all([
          fetchUserProfile(user.uid),
          fetchUserRoles(user.uid)
        ]);

        const resolvedActiveRole =
          rolesData.activeRole || profile?.activeRole || null;

        setUser({ ...user, ...profile });
        setUserRoles({
          ...rolesData,
          activeRole: resolvedActiveRole,
        });
        setActiveRole(resolvedActiveRole);
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  };

  const authenticateWithLinkedAccount = async (userData) => {
    try {
      const firebaseUser = auth.currentUser;

      if (!firebaseUser || firebaseUser.uid !== userData.uid) {
        return {
          success: false,
          error: 'Firebase authentication session is missing. Please log in again.',
        };
      }

      // Manually set authentication state for linked accounts
      const rolesData = await fetchUserRoles(userData.uid);

      const userObj = {
        uid: userData.uid,
        email: userData.email,
        phoneNumber: userData.phone || userData.phoneNumber,
        emailVerified: true,
        ...userData
      };

      const resolvedActiveRole =
        rolesData.activeRole || userData.activeRole || null;

      setUser(userObj);
      setUserRoles({
        ...rolesData,
        activeRole: resolvedActiveRole,
      });
      setActiveRole(resolvedActiveRole);
      setIsLoggedIn(true);

      return { success: true };
    } catch (error) {
      console.error('Error authenticating with linked account:', error);
      return { success: false, error: error.message };
    }
  };

  const getNavigationDestination = (rolesData) => {
    if (!rolesData || !rolesData.roles) return 'Login';
    
    const roles = rolesData.roles;
    const trueRoles = Object.keys(roles).filter((r) => roles[r]);
    
    if (trueRoles.length === 1) {
      const role = trueRoles[0];
      return role === 'client' ? 'ClientDashboard' : 
             role === 'customer' ? 'MainTabs' : // Route customers to MainTabs (Home) instead of CustomerDashboard
             role === 'admin' ? 'AdminDashboard' : 'RoleSelection';
    }
    
    if (trueRoles.length === 0) return 'RoleSelection';
    return 'RoleSelection';
  };

  const value = {
    isLoggedIn,
    user,
    userRoles,
    activeRole,
    isLoading,
    login,
    logout,
    register,
    refreshUserData,
    authenticateWithLinkedAccount,
    getNavigationDestination,
    isAuthenticated: Boolean(auth.currentUser && user),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
