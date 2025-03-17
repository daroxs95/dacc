import styles from "./Invoice.module.css";
import {type Lang, useLang} from "~/hooks/useLang";

type Item = {
    description: string;
    quantity: number;
    rate: number;
}

interface InvoiceProps {
    created: string;
    due: string;
    invoiceNumber: string;
    items: Item[];
    showLogo?: boolean;
    company?: Company;
    companyToBill?: Company;
    paid?: boolean;
    language: Lang;
}

export function Invoice({created, due, invoiceNumber, items, showLogo, company, paid, companyToBill, language}: InvoiceProps) {
    const total = items.reduce((acc, curr) => {
        return acc + curr.quantity * curr.rate
    }, 0);

    const {t} = useLang(language);

    return (
        <div className={`${styles.invoiceBox}`}>
            <table cellPadding="0" cellSpacing="0">
                <tr className={styles.top}>
                    <td colSpan={4}>
                        <table>
                            <tr>
                                <td className={styles.title}>
                                    {showLogo && <img
                                        src="/darologo.png"
                                        style={{
                                            width: "100%",
                                            maxWidth: "80px"
                                        }}
                                    />}
                                </td>

                                <td>
                                    {t("Invoice")} #: {invoiceNumber}<br/>
                                    {t("Created")}: {created}<br/>
                                    {t("Due")}: {due}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <tr className={styles.information}>
                    <td colSpan={4}>
                        <table>
                            <th></th>
                            <th>{t("Bill to")}</th>
                            <tr>
                                <td>
                                    {company?.name}<br/>
                                    {company?.address}<br/>
                                    {company?.city}, {company?.country}, {company?.postalCode}<br/>
                                    {company?.email}
                                </td>

                                <td>
                                    {companyToBill?.name}<br/>
                                    {companyToBill?.address}<br/>
                                    {companyToBill?.city}, {companyToBill?.country}, {companyToBill?.postalCode}<br/>
                                    {companyToBill?.email}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                {/*<tr className={styles.heading}>*/}
                {/*    <td>Método de pago</td>*/}

                {/*    <td> #</td>*/}
                {/*</tr>*/}

                {/*<tr className={styles.details}>*/}
                {/*    <td>Check</td>*/}

                {/*    <td>1000</td>*/}
                {/*</tr>*/}

                <tr className={styles.heading}>
                    <td>{t("Item & Description")}</td>
                    <td>{t("Amount")}</td>
                    <td>{t("Rate")}</td>
                    <td>{t("Total")}</td>
                </tr>

                {items.map((item, index) => (
                    <tr className={styles.item}>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>${item.rate}</td>
                        <td>${item.quantity * item.rate}</td>
                    </tr>
                ))}

                <tr className={styles.total}>
                    <td></td>
                    <td></td>
                    <td></td>

                    <td>
                        {t("Total")}: ${total}
                    </td>
                    
                </tr>
                {paid &&
                    (<>
                        <tr className={styles.item}>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>
                                {t("Payment")}: (-) ${total}
                            </td>
                        </tr>
                        <tr className={styles.total}>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>
                                {t("Balance due")}: ${0}
                            </td>
                        </tr>
                    </>)
                }
            </table>
        </div>
    )
}