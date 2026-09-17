// Parsing a pasted demo-media URL into something renderable.
//
// YouTube gives out a different URL shape depending on where you copied from, and the phone
// Share button appends tracking params (?si=...). The original parser knew only watch?v=,
// youtu.be/ and /embed/ — so a pasted Short fell through to the <img> branch and rendered as a
// broken image, which is exactly what a trainer sees after filming a demo and pasting the link.
//
// Video ids are always 11 chars of [A-Za-z0-9_-].
const YOUTUBE_ID =
  /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/i;

export const parseMediaUrl = (raw) => {
  const url = String(raw || "").trim();
  if (!url) return { kind: "none" };

  const match = url.match(YOUTUBE_ID);
  if (match) {
    const id = match[1];
    return {
      kind: "youtube",
      id,
      // Shorts are filmed vertically (9:16). Nothing else in the URL reveals the shape, so the
      // /shorts/ path is the only signal — and a 16:9 frame letterboxes a vertical clip into a
      // thin strip between two black bars.
      vertical: /youtube\.com\/shorts\//i.test(url),
      embedSrc: `https://www.youtube.com/embed/${id}`,
      thumbSrc: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    };
  }

  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return { kind: "video", src: url };
  return { kind: "image", src: url };
};

export default parseMediaUrl;
