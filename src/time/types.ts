// Time feature types
export interface UserTimezone {
    user_id: string;
    timezone: string;
    display_location: string;
    fetched_at?: number;
}

export interface TimezoneData {
    location_name: string;
    timezone: string;
    display_location: string;
    cached_at: number;
}

