/**
 * Shared PDF sub-components used across coverage pages.
 */

import { View, Text, Image } from '@react-pdf/renderer';
import { s } from './shared';

export function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Confidential — For Lemon Studios internal use only</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

export function IntHeader({ title }: { title: string }) {
  return (
    <View style={s.intHeader}>
      <View style={s.intHeaderLeft}>
        <Image src="/lemon-logo-black.png" style={s.intLogo} />
        <Text style={s.intBrand}>Lemon Studios</Text>
      </View>
      <Text style={s.intTitle}>{title}</Text>
    </View>
  );
}
