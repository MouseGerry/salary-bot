export interface Data {
    stakes:      { [key: string]: Stake };
    prepayments: number[];
    payments:    any[];
    sales:       Sale[];
}

export interface Sale {
    date:  string;
    place: Place;
    sales: number;
}

export type Place =  "Воробкевича" | "Проспект" | "Шептицького";


export interface Stake {
    stake:   number;
    percent: number;
}