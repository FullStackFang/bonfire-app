import {
  useFonts as useSourceSerif,
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_500Medium,
  SourceSerif4_600SemiBold,
} from "@expo-google-fonts/source-serif-4";
import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
} from "@expo-google-fonts/onest";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono";

export function useLoadFonts() {
  const [loaded, error] = useSourceSerif({
    SourceSerif4_400Regular,
    SourceSerif4_400Regular_Italic,
    SourceSerif4_500Medium,
    SourceSerif4_600SemiBold,
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    GeistMono_400Regular,
  });
  return { loaded, error };
}
