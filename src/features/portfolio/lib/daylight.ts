/**
 * The sky over the range at a given moment, for "Kathmandu at this hour" (decision 0182).
 *
 * `HOME` is a design setting, not content: the hero's light is computed for
 * the place the site is about. The sun's position uses NOAA's solar
 * calculator (the spreadsheet algorithm, about a minute of accuracy), and
 * the results that reach the markup are rounded, so the server and the
 * browser render the same sky for the same instant.
 */

export const HOME = {
	timeZone: "Asia/Kathmandu",
	/** Nepal keeps one offset all year: UTC+5:45. */
	utcOffsetMinutes: 345,
	latitude: 27.7172,
	longitude: 85.324,
} as const;

export type SkyPhase = "night" | "dawn" | "day" | "dusk";

export type Sky = {
	phase: SkyPhase;
	/** The sun's height above the horizon, in whole degrees. */
	elevation: number;
	/**
	 * Where the sun sits in the view (the range is seen looking north), as whole
	 * percentages of the frame; null when it is behind the viewer or below the horizon.
	 */
	sun: { x: number; y: number } | null;
	/** True while the peaks catch the low sun: the first and last light of the day. */
	alpenglow: boolean;
};

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;
const mod = (value: number, by: number) => ((value % by) + by) % by;

type SolarDay = { declination: number; equationOfTime: number };

/** The sun's declination and the equation of time (minutes) at a moment (NOAA). */
function solarDay(time: number): SolarDay {
	const julianCentury = (time / 86_400_000 + 2_440_587.5 - 2_451_545) / 36_525;
	const meanLongitude = mod(280.46646 + julianCentury * (36_000.76983 + julianCentury * 0.0003032), 360);
	const meanAnomaly = 357.52911 + julianCentury * (35_999.05029 - 0.0001537 * julianCentury);
	const eccentricity = 0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);
	const centre =
		Math.sin(rad(meanAnomaly)) * (1.914602 - julianCentury * (0.004817 + 0.000014 * julianCentury)) +
		Math.sin(rad(2 * meanAnomaly)) * (0.019993 - 0.000101 * julianCentury) +
		Math.sin(rad(3 * meanAnomaly)) * 0.000289;
	const node = 125.04 - 1934.136 * julianCentury;
	const apparentLongitude = meanLongitude + centre - 0.00569 - 0.00478 * Math.sin(rad(node));
	const meanObliquity =
		23 + (26 + (21.448 - julianCentury * (46.815 + julianCentury * (0.00059 - julianCentury * 0.001813))) / 60) / 60;
	const obliquity = meanObliquity + 0.00256 * Math.cos(rad(node));
	const declination = deg(Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(apparentLongitude))));
	const y = Math.tan(rad(obliquity / 2)) ** 2;
	const equationOfTime =
		4 *
		deg(
			y * Math.sin(2 * rad(meanLongitude)) -
				2 * eccentricity * Math.sin(rad(meanAnomaly)) +
				4 * eccentricity * y * Math.sin(rad(meanAnomaly)) * Math.cos(2 * rad(meanLongitude)) -
				0.5 * y * y * Math.sin(4 * rad(meanLongitude)) -
				1.25 * eccentricity * eccentricity * Math.sin(2 * rad(meanAnomaly)),
		);
	return { declination, equationOfTime };
}

/** The sun's elevation and azimuth (degrees, azimuth clockwise from north) at a moment and place. */
export function sunPosition(time: number, latitude: number = HOME.latitude, longitude: number = HOME.longitude) {
	const { declination, equationOfTime } = solarDay(time);
	const minutesUtc = mod(time, 86_400_000) / 60_000;
	const trueSolarTime = mod(minutesUtc + equationOfTime + 4 * longitude, 1440);
	const hourAngle = trueSolarTime / 4 < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180;
	const cosZenith =
		Math.sin(rad(latitude)) * Math.sin(rad(declination)) +
		Math.cos(rad(latitude)) * Math.cos(rad(declination)) * Math.cos(rad(hourAngle));
	const zenith = deg(Math.acos(Math.max(-1, Math.min(1, cosZenith))));
	const cosAzimuth =
		(Math.sin(rad(latitude)) * Math.cos(rad(zenith)) - Math.sin(rad(declination))) /
		(Math.cos(rad(latitude)) * Math.sin(rad(zenith)));
	const angle = deg(Math.acos(Math.max(-1, Math.min(1, cosAzimuth))));
	const azimuth = hourAngle > 0 ? mod(angle + 180, 360) : mod(540 - angle, 360);
	return { elevation: 90 - zenith, azimuth, morning: hourAngle < 0 };
}

/**
 * Sunrise and sunset (as instants) on the local calendar day of `time` in
 * Kathmandu: the sun's centre 0.833° below the horizon (refraction and the disc).
 */
export function sunTimes(time: number, latitude: number = HOME.latitude, longitude: number = HOME.longitude) {
	const offset = HOME.utcOffsetMinutes * 60_000;
	const localMidnight = Math.floor((time + offset) / 86_400_000) * 86_400_000 - offset;
	const noonGuess = localMidnight + 12 * 3_600_000;
	const { declination, equationOfTime } = solarDay(noonGuess);
	const cosHourAngle =
		Math.cos(rad(90.833)) / (Math.cos(rad(latitude)) * Math.cos(rad(declination))) -
		Math.tan(rad(latitude)) * Math.tan(rad(declination));
	const hourAngle = deg(Math.acos(Math.max(-1, Math.min(1, cosHourAngle))));
	const utcMidnight = Math.floor(noonGuess / 86_400_000) * 86_400_000;
	const solarNoon = utcMidnight + (720 - 4 * longitude - equationOfTime) * 60_000;
	return { sunrise: solarNoon - hourAngle * 4 * 60_000, sunset: solarNoon + hourAngle * 4 * 60_000 };
}

/** How wide the view is on each side of north, in degrees of azimuth. */
const VIEW_HALF_WIDTH = 115;
/** Elevation that maps to the top of the sky in the frame. */
const VIEW_TOP = 24;

/** The sky over Kathmandu at `time` (milliseconds since the epoch). */
export function skyAt(time: number): Sky {
	const { elevation, azimuth, morning } = sunPosition(time);
	const phase: SkyPhase = elevation >= 6 ? "day" : elevation >= -6 ? (morning ? "dawn" : "dusk") : "night";
	// Facing north: east is to the right, west to the left.
	const fromNorth = azimuth > 180 ? azimuth - 360 : azimuth;
	const visible = elevation > -1.5 && elevation < VIEW_TOP && Math.abs(fromNorth) <= VIEW_HALF_WIDTH;
	return {
		phase,
		elevation: Math.round(elevation),
		sun: visible
			? {
					x: Math.round(50 + (fromNorth / VIEW_HALF_WIDTH) * 46),
					y: Math.round(Math.max(0, Math.min(1, elevation / VIEW_TOP)) * 70),
				}
			: null,
		alpenglow: elevation > -5 && elevation < 7,
	};
}

/** Minutes the visitor's clock is behind Kathmandu's (negative when ahead), from their UTC offset. */
export const minutesBehindHome = (visitorUtcOffsetMinutes: number) => HOME.utcOffsetMinutes - visitorUtcOffsetMinutes;
