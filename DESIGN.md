---
name: Horizon Ethos
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#424654'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#737785'
  outline-variant: '#c3c6d6'
  surface-tint: '#0657ce'
  primary: '#003f9c'
  on-primary: '#ffffff'
  primary-container: '#0055cc'
  on-primary-container: '#c8d5ff'
  inverse-primary: '#b1c5ff'
  secondary: '#555f6c'
  on-secondary: '#ffffff'
  secondary-container: '#d9e3f2'
  on-secondary-container: '#5b6572'
  tertiary: '#7d2900'
  on-tertiary: '#ffffff'
  tertiary-container: '#a53800'
  on-tertiary-container: '#ffcab7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b1c5ff'
  on-primary-fixed: '#001947'
  on-primary-fixed-variant: '#00419f'
  secondary-fixed: '#d9e3f2'
  secondary-fixed-dim: '#bdc7d6'
  on-secondary-fixed: '#131c27'
  on-secondary-fixed-variant: '#3e4853'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#802a00'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: '0'
  headline-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.5px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: auto
  max-width: 1280px
---

## Brand & Style

The design system is engineered for a premium, high-velocity travel experience. It balances the reliability of established financial institutions with the kinetic energy of modern exploration. The visual language is **Corporate / Modern**, characterized by high-contrast interfaces, precision-engineered components, and a focus on clarity and speed.

The aesthetic prioritizes a "frictionless path to discovery." It uses generous whitespace to reduce cognitive load during complex booking flows while employing vibrant accent colors to signal momentum and urgency. The system is built from the ground up to support Right-to-Left (RTL) logic as a primary orientation, ensuring that the visual weight and directional flow feel natural to Arabic-speaking users.

## Colors

The palette is anchored by **Traveler Blue**, representing trust, depth, and the horizon. This is complemented by **Sky Blue**, used primarily for large-surface areas, backgrounds, and subtle grouping to keep the interface feeling airy and expansive.

**Action Orange** serves as the system's high-energy catalyst. It is reserved exclusively for primary calls to action, price highlights, and critical status updates. This creates a clear visual hierarchy where "Search" and "Book" actions are impossible to miss. 

The neutral scale favors cool greys to maintain a crisp, professional environment, ensuring that photography of destinations remains the focal point of the UI.

## Typography

The typography system utilizes **IBM Plex Sans Arabic**, chosen for its exceptional legibility in both Latin and Arabic scripts. This ensures a unified "voice" when displaying multi-language content or technical flight codes. 

Headlines are bold and authoritative, using tighter line-heights to create a sense of density and importance. Body text is optimized for long-form reading of hotel descriptions, utilizing a generous line-height to maintain "breathing room." In RTL contexts, text alignment is strictly right-aligned, with specific attention paid to numerals (Latin numerals are preferred for pricing clarity).

## Layout & Spacing

This design system employs a **fixed grid** approach for desktop to ensure a controlled, premium reading experience, while transitioning to a **fluid grid** for mobile devices. 

- **Desktop:** A 12-column grid centered on the page with a 1280px max-width.
- **Tablet:** 8-column grid with 24px side margins.
- **Mobile:** 4-column grid with 16px side margins.

Spacing follows a strict 8px base unit. Larger gaps (40px+) are used to separate major sections (e.g., "Featured Deals" from "Search Results"), while tighter spacing (12px) is used within component clusters like flight segments. In RTL layouts, the horizontal progression moves from right to left, meaning the primary "entry point" of any section is the top-right corner.

## Elevation & Depth

The design system uses **Tonal Layers** and **Ambient Shadows** to define the hierarchy of information. 

1. **Base Layer:** The background is `#F8F9FA`, providing a neutral canvas.
2. **Card Layer:** Individual flight and hotel results are housed in white containers (`#FFFFFF`) with a subtle 1px border (`#E0E0E0`).
3. **Elevated Layer:** Active search bars and "Book Now" widgets use a soft, large-radius shadow (Blur: 20px, Opacity: 8%, Color: Traveler Blue) to appear as if floating above the content.
4. **Overlay Layer:** Modals, date pickers, and menus use a backdrop blur (12px) and a semi-transparent dark overlay to focus the user’s attention entirely on the task at hand.

## Shapes

The shape language is **Rounded**, reflecting a modern and approachable brand character. 

- **Containers & Cards:** Use a 0.5rem (8px) corner radius to strike a balance between professional structure and friendly accessibility.
- **Input Fields:** Use 8px rounded corners to match the card containers.
- **Buttons & Price Badges:** Utilize a more pronounced 1rem (16px) or full pill-shape to distinguish interactive elements from static content containers.
- **Images:** All destination imagery should carry a 12px (rounded-lg) radius to soften the high-energy layout.

## Components

### Buttons
- **Primary:** Action Orange background with White text. Used for "Search" and "Confirm Booking."
- **Secondary:** White background with Traveler Blue border and text. Used for "View Details" or "Filters."
- **Interaction:** On hover, primary buttons darken by 10%; on press, they scale slightly (98%).

### Search Bars
- Search bars are the "Anchor" of the OTA. They feature a white background with 1px Traveler Blue border when focused. Icons (Magnifying glass, Location pin) are placed on the left of the input in RTL layouts.

### Flight & Hotel Cards
- Cards feature a horizontal layout on desktop and vertical on mobile. 
- **Price Badge:** Always placed in the bottom-left corner (in RTL) or top-left (mobile) using Action Orange text for maximum visibility.
- **Labels:** Use "Label Sm" for metadata like "Non-stop" or "Refundable."

### Date Pickers
- High-contrast grids with Traveler Blue highlighting the selected range. Today's date is indicated by an Action Orange underline.

### Checkboxes & Radios
- Custom-styled circles/squares using Traveler Blue for the active state, ensuring they are large enough for easy tapping on mobile (minimum 44px hit area).
