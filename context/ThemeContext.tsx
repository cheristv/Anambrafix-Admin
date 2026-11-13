
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import { useColorScheme } from "react-native";

export type ThemePreference = "light" | "dark" | "system";

const lightTheme = {
  background: "#F7F9F7",
  surface: "#FFFFFF",
  text: "#203329",
  secondaryText: "#78857D",
  border: "#E8EDE9",
  primary: "#176B45",
  inputBackground: "#F6F8F6",
  danger: "#B83232",
};

const darkTheme = {
  background: "#101A14",
  surface: "#1B2920",
  text: "#F1F5F2",
  secondaryText: "#A8B6AC",
  border: "#304237",
  primary: "#58B982",
  inputBackground: "#24342A",
  danger: "#FF8585",
};

type ThemeColors = typeof lightTheme;

type ThemeContextType = {
  preference: ThemePreference;
  theme: ThemeColors;
  isDark: boolean;
  setPreference: (value: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();

  // The app starts in Light Mode unless the administrator has saved another choice.
  const [preference, setPreferenceState] =
    useState<ThemePreference>("light");

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem(
          "admin_theme_preference"
        );

        if (
          savedPreference === "light" ||
          savedPreference === "dark" ||
          savedPreference === "system"
        ) {
          setPreferenceState(savedPreference);
        }
      } catch (error) {
        console.log("Could not load theme preference:", error);
      } finally {
        setLoaded(true);
      }
    };

    loadPreference();
  }, []);

  const setPreference = async (value: ThemePreference) => {
    setPreferenceState(value);

    try {
      await AsyncStorage.setItem("admin_theme_preference", value);
    } catch (error) {
      console.log("Could not save theme preference:", error);
    }
  };

  const isDark =
    preference === "system"
      ? systemColorScheme === "dark"
      : preference === "dark";

  const theme = isDark ? darkTheme : lightTheme;

  if (!loaded) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        preference,
        theme,
        isDark,
        setPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used inside ThemeProvider");
  }

  return context;
}
