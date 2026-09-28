/**
 * Curated pool of real football manager photos used as profile pictures.
 *
 * Source: Wikimedia Commons (openly licensed, CC BY / CC BY-SA / public
 * domain). Images are served through Commons' stable Special:FilePath
 * endpoint, which redirects to a 480px thumbnail of the original file. Every
 * entry links back to its file page for attribution, and the UI falls back to
 * the user's initials when a photo cannot be loaded.
 *
 * EA SPORTS FC does not publish a public manager-avatar API, so this pool
 * combines the best openly available portraits of real dugout legends.
 */
function commons(file) {
    return {
        photo: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`,
        page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
    };
}
function avatar(id, name, file) {
    return { id, name, ...commons(file) };
}
export const COACH_AVATARS = [
    avatar("guardiola", "Pep Guardiola", "Pep Guardiola 9498.jpg"),
    avatar("ancelotti", "Carlo Ancelotti", "Carlo Ancelotti pelo Bayern.jpg"),
    avatar("mourinho", "José Mourinho", "Fenerbahce manager Jose Mourinho and Ali Koç, June 2024 (cropped).jpg"),
    avatar("klopp", "Jürgen Klopp", "Jürgen Klopp (14695960278).jpg"),
    avatar("simeone", "Diego Simeone", "Diego Simeone - 01.jpg"),
    avatar("arteta", "Mikel Arteta", "Mikel Arteta Arsenal Borussia Dortmund.jpg"),
    avatar("slot", "Arne Slot", "Arne Slot 04012026 (2).jpg"),
    avatar("xabi", "Xabi Alonso", "Xabi Alonso Real Sociedad B (cropped).jpg"),
    avatar("zidane", "Zinedine Zidane", "Zinedine Zidane 2008.jpg"),
    avatar("conte", "Antonio Conte", "Antonio Conte December 2016.jpg"),
    avatar("bielsa", "Marcelo Bielsa", "Marcelo Bielsa OM 2015 Cropped.jpg"),
    avatar("flick", "Hansi Flick", "Hans-Dieter Flick during a press conference in April 2025 at FC Barcelona.jpg"),
    avatar("wiegman", "Sarina Wiegman", "Sarina Wiegman ENG vs CZE (cropped).jpg"),
];
