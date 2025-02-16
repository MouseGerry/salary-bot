export interface Data {
    stakes:   { [key: string]: Stake };
    payments: number[];
    sales:    Sale[];
}

export interface Sale {
    date:  string;
    place: Place;
    sales: number;
}

export type Place = "Воробкевича" | "Проспект" |"Шептицького"

export interface Stake {
    stake:   number;
    percent: number;
}
