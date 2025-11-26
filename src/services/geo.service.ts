import NodeGeocoder from 'node-geocoder';
import * as GeoTZ from 'geo-tz';

type GeocoderOptions = Parameters<typeof NodeGeocoder>[0];

const geocoder = NodeGeocoder({
    provider: 'openstreetmap',
    userAgent: 'xiuh_bot_ts_v1'
} as GeocoderOptions & { userAgent: string });

export const getTimezoneFromCity = async (city: string): Promise<{ timezone: string, address: string } | null> => {
    try {
        const results = await geocoder.geocode(city);
        if (!results || results.length === 0) return null;

        const { latitude, longitude, formattedAddress } = results[0];
        
        if (!latitude || !longitude) return null;

        const timezones = GeoTZ.find(latitude, longitude);
        if (!timezones || timezones.length === 0) return null;

        return {
            timezone: timezones[0],
            address: formattedAddress || city
        };
    } catch (error) {
        console.error("Geo Error:", error);
        return null;
    }
};