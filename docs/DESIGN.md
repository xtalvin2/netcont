## Vibe
- Vibrant Block-based Dashboard — oversized saturated color blocks as structural anchors; bold sans-serif type; data-first hierarchy with ultra-minimal motion; inspired by modern African fintech dashboards

## Color
- Primary: #F46800
- On Primary: #0F172A
- Accent: #3D71D9
- On Accent: #FFFFFF
- Background: #181B1F
- Foreground: #D9D9D9
- Muted: #242629
- Border: #34373B
- Secondary: #DC5C00

## Typography
- Heading: Urbanist (family: 'Urbanist', sans-serif, weight: 700, url: https://resource-static.bj.bcebos.com/fonts-skill/Urbanist_Urbanist[wght].ttf)
- Body: Urbanist (family: 'Urbanist', sans-serif, weight: 400, url: https://resource-static.bj.bcebos.com/fonts-skill/Urbanist_Urbanist[wght].ttf)

## Visual Language
- Core visual signature: KPI metric cards use oversized number type (text-5xl+) as visual anchor; primary orange strip accent bars mark active states and section headers
- Material & depth: dark muted card surfaces (#242629) elevated over near-black background (#181B1F); no box-shadow — depth via surface brightness contrast only
- Containers & buttons: squared corners (radius 8px); card borders use Border token; primary CTA uses #F46800 fill with dark text; secondary uses Muted fill with Foreground text
- Layout rhythm: sidebar nav with orange active-state indicators; dashboard grid alternates dense KPI cards with spacious chart panels; table rows use alternating muted/background tones

## Animation
- Entrance: KPI number counters animate up from 0 on mount, 600ms ease-out
- Interaction: button press scales to 0.97, 100ms; table row hover brightens surface, 150ms
- Scroll / transition: page-level fade-in 200ms on route change

## Forbidden
- No frosted glass or blur-based cards
- No gradient fills on large surfaces or hero sections
- No emoji or decorative icons in headers and navigation

## Additional Notes
- All currency values display in Nigerian Naira (₦ / NGN)
- Phone number format: Nigerian 11-digit (080/081/090/070 prefix)
- Dark mode is the default and primary theme; light mode is optional
- Admin login page: full-bleed dark background with left side branding panel + right side form
