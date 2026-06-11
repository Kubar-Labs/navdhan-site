import ndLogo from '../assets/nd-logo.png'

interface Props {
  /** Height of the logo image in px. */
  size?: number
  /** Kept for API compatibility; the Navdhan logo lockup already includes the name. */
  showName?: boolean
}

// The Navdhan logo has white "NAVDHAN" text on a transparent background, so it
// sits in a dark (ink) chip to stay legible on the portal's white header —
// matching the marketing site's header treatment.
export default function Logo({ size = 32 }: Props) {
  return (
    <span className="inline-flex items-center rounded-xl bg-ink px-3 py-1.5">
      <img
        src={ndLogo}
        alt="Navdhan by Kubar Labs"
        className="w-auto object-contain"
        style={{ height: size }}
      />
    </span>
  )
}
