// No "use client" needed - purely presentational, safe to import from
// Server Components (the home page) and Client Components (everywhere
// else) alike. Renders the child's photo if they have one, falling back to
// their emoji avatar otherwise.

export default function Avatar({
  photoDataUrl,
  avatar,
  name,
  className = "h-full w-full",
}: {
  photoDataUrl?: string | null;
  avatar: string;
  name?: string;
  className?: string;
}) {
  if (photoDataUrl) {
    // A data: URL isn't something next/image's remote-loader pipeline is
    // built for, and these are already-tiny resized thumbnails anyway.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoDataUrl} alt={name ? `${name}'s photo` : "Photo"} className={`rounded-full object-cover ${className}`} />;
  }
  return <span>{avatar}</span>;
}
