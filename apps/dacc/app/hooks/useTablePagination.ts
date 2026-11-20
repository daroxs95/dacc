import {useState} from "react";

const ROWS_PER_PAGE = 10;

export function useTablePagination(total: number) {
    const [requestedPage, setPage] = useState(1);
    const pageCount = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
    const page = Math.min(requestedPage, pageCount);
    if (requestedPage !== page) setPage(page);

    const start = (page - 1) * ROWS_PER_PAGE;
    return {page, pageCount, start, end: Math.min(start + ROWS_PER_PAGE, total), total, setPage};
}
