import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    let initTimeout;
    let profileTimeout;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // Check for mock user first (for testing)
        const mockUser = localStorage.getItem('mockUser');
        const mockProfile = localStorage.getItem('mockProfile');
        
        if (mockUser && mockProfile) {
          console.log('Using mock user data');
          if (mounted) {
            setUser(JSON.parse(mockUser));
            setProfile(JSON.parse(mockProfile));
            setLoading(false);
            setInitialized(true);
          }
          return;
        }

        // Get initial session with timeout
        console.log('Getting Supabase session...');
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
          initTimeout = setTimeout(() => reject(new Error('Session timeout')), 10000);
        });

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (initTimeout) {
          clearTimeout(initTimeout);
        }
        
        if (error) {
          console.error('Error getting session:', error);
        }

        if (mounted) {
          if (session?.user) {
            console.log('Found existing session for user:', session.user.id);
            setUser(session.user);
            // Fetch profile with non-blocking error handling
            fetchUserProfile(session.user.id).catch(error => {
              console.warn('Profile fetch failed during initialization:', error);
              // Don't block initialization if profile fetch fails
            });
          } else {
            console.log('No existing session found');
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
          setInitialized(true);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          // Don't block the app if initialization fails
          setLoading(false);
          setInitialized(true);
          setUser(null);
          setProfile(null);
        }
      }
    };

    // Set a maximum initialization time
    const maxInitTime = setTimeout(() => {
      if (mounted && !initialized) {
        console.warn('Auth initialization taking too long, forcing completion');
        setLoading(false);
        setInitialized(true);
      }
    }, 12000); // Reduced from 15 seconds to 12 seconds

    initializeAuth();

    // Listen for auth changes only after initialization
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!initialized) return; // Don't process events during initialization
      
      console.log('Auth state change:', event, session?.user?.id);
      
      if (mounted) {
        if (session?.user) {
          setUser(session.user);
          // Fetch profile with non-blocking error handling
          fetchUserProfile(session.user.id).catch(error => {
            console.warn('Profile fetch failed during auth change:', error);
          });
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (initTimeout) clearTimeout(initTimeout);
      if (profileTimeout) clearTimeout(profileTimeout);
      if (maxInitTime) clearTimeout(maxInitTime);
      subscription.unsubscribe();
    };
  }, [initialized]);

  const fetchUserProfile = async (userId) => {
    let profileTimeout;
    
    try {
      console.log('Fetching profile for user:', userId);
      
      // Add timeout to profile fetch - reduced to 6 seconds for faster failure
      const profilePromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId);
        
      const timeoutPromise = new Promise((_, reject) => {
        profileTimeout = setTimeout(() => reject(new Error('Profile fetch timeout')), 6000);
      });

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (profileTimeout) {
        clearTimeout(profileTimeout);
      }

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      
      // Check if data exists and has at least one row
      if (data && data.length > 0) {
        console.log('Profile fetched successfully:', data[0]);
        setProfile(data[0]);
      } else {
        console.log('Profile not found, user might need to complete registration');
        setProfile(null);
      }
    } catch (error) {
      if (profileTimeout) {
        clearTimeout(profileTimeout);
      }
      
      console.error('Error fetching profile:', error);
      
      // If it's a timeout error, don't block the app - just log and continue
      if (error.message.includes('timeout')) {
        console.warn('Profile fetch timed out, user can continue without full profile');
        setProfile(null);
      } else {
        // For other errors, also don't block the app
        console.warn('Profile fetch failed, user can continue without profile');
        setProfile(null);
      }
    }
  };

  const signUp = async (email, password, name, role) => {
    try {
      console.log('Starting signup process for:', email);
      setLoading(true);
      
      // First check if user table exists by trying to query it
      const { error: tableError } = await supabase
        .from('users')
        .select('id')
        .limit(1);

      if (tableError && tableError.code === '42P01') {
        console.error('Database table not found');
        return { 
          data: null, 
          error: { message: 'Database not set up. Please connect to Supabase and run migrations first.' }
        };
      }

      // Create auth user
      console.log('Creating auth user...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined // Disable email confirmation
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }

      console.log('Auth user created:', authData.user?.id);

      if (authData.user) {
        // Create user profile - wait a moment for auth to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('Creating user profile...');
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              email,
              name,
              role,
              xp_points: 0,
              badges: []
            }
          ])
          .select()
          .single();

        if (profileError) {
          console.error('Profile creation error:', profileError);
          
          // If profile creation fails, clean up the auth user
          await supabase.auth.signOut();
          
          if (profileError.code === '23505') {
            throw new Error('A profile with this email already exists.');
          }
          throw profileError;
        }

        console.log('Profile created successfully:', profileData);
        
        // Set the profile immediately
        setProfile(profileData);
        
        // The auth state change will handle setting the user
      }

      return { data: authData, error: null };
    } catch (error) {
      console.error('Signup error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      console.log('Starting signin process for:', email);
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Signin error:', error);
        throw error;
      }

      console.log('Signin successful:', data.user?.id);
      
      // Profile will be fetched automatically by the auth state change listener
      return { data, error: null };
    } catch (error) {
      console.error('Signin error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    console.log('Signing out...');
    setLoading(true);
    
    try {
      // Clear mock data
      localStorage.removeItem('mockUser');
      localStorage.removeItem('mockProfile');
      
      const { error } = await supabase.auth.signOut();
      if (!error) {
        setUser(null);
        setProfile(null);
      }
      
      return { error };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const updateXP = async (points) => {
    if (!profile) return;

    try {
      const newXP = profile.xp_points + points;
      
      // Handle mock users
      if (localStorage.getItem('mockUser')) {
        const updatedProfile = { ...profile, xp_points: newXP };
        localStorage.setItem('mockProfile', JSON.stringify(updatedProfile));
        setProfile(updatedProfile);
        checkBadgeProgress(newXP);
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ xp_points: newXP })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, xp_points: newXP }));
      
      // Check for new badges
      checkBadgeProgress(newXP);
    } catch (error) {
      console.error('Error updating XP:', error);
    }
  };

  const checkBadgeProgress = async (xp) => {
    const newBadges = [];
    
    if (xp >= 100 && !profile.badges.includes('first-hundred')) {
      newBadges.push('first-hundred');
    }
    if (xp >= 500 && !profile.badges.includes('xp-master')) {
      newBadges.push('xp-master');
    }

    if (newBadges.length > 0) {
      const updatedBadges = [...profile.badges, ...newBadges];
      
      // Handle mock users
      if (localStorage.getItem('mockUser')) {
        const updatedProfile = { ...profile, badges: updatedBadges };
        localStorage.setItem('mockProfile', JSON.stringify(updatedProfile));
        setProfile(updatedProfile);
        return;
      }

      await supabase
        .from('users')
        .update({ badges: updatedBadges })
        .eq('id', user.id);

      setProfile(prev => ({ ...prev, badges: updatedBadges }));
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateXP,
    fetchUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};