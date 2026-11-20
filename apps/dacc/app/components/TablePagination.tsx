import {useLang} from "~/hooks/useLang";
import type {useTablePagination} from "~/hooks/useTablePagination";

export function TablePagination({pagination}: {pagination: ReturnType<typeof useTablePagination>}) {
    const {t, number} = useLang();
    const {page, pageCount, start, end, total, setPage} = pagination;
    if (pageCount < 2) return null;

    return <div className="toolbar f-jc-between" role="group" aria-label={t("Pagination")}>
        <p className="card-subtitle" role="status">
            {t("Rows {start}–{end} of {total}", {start: number(start + 1), end: number(end), total: number(total)})}
        </p>
        <div className="toolbar">
            <button type="button" className="secondary compact" disabled={page === 1}
                onClick={() => setPage(page - 1)}>{t("Previous")}</button>
            <span>{t("Page {page} of {total}", {page: number(page), total: number(pageCount)})}</span>
            <button type="button" className="secondary compact" disabled={page === pageCount}
                onClick={() => setPage(page + 1)}>{t("Next")}</button>
        </div>
    </div>;
}
