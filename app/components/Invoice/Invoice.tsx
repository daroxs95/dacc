import styles from "./Invoice.module.css";

type Item = {
    description: string;
    quantity: number;
    rate: number;
}

type Company = {
    name: string;
    address: string;
    city: string;
    country: string;
    email: string;
    postalCode: string;
}

interface InvoiceProps {
    created: string;
    due: string;
    invoiceNumber: string;
    items: Item[];
    showLogo?: boolean;
    company?: Company;
    paid?: boolean;
}

export function Invoice({created, due, invoiceNumber, items, showLogo, company, paid}: InvoiceProps) {
    const total = items.reduce((acc, curr) => {
        return acc + curr.quantity * curr.rate
    }, 0);
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
                                    Factura #: {invoiceNumber}<br/>
                                    Creada: {created}<br/>
                                    Fecha de vencimiento: {due}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <tr className={styles.information}>
                    <td colSpan={4}>
                        <table>
                            <th></th>
                            <th>Facturar a</th>
                            <tr>
                                <td>
                                    {company?.name}<br/>
                                    {company?.address}<br/>
                                    {company?.city}, {company?.country}, {company?.postalCode}<br/>
                                    {company?.email}
                                </td>

                                <td>
                                    Tetraimpacts, S.A.<br/>
                                    Km 13, Carretera Sur <br/>
                                    El Crucero, Managua, Nicaragua, 16100
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
                    <td>Artículo & Descripción</td>
                    <td>Cantidad</td>
                    <td>Tarifa</td>
                    <td>Total</td>
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
                        Total: ${total}
                    </td>
                    
                </tr>
                {paid&&
                    (<>
                        <tr className={styles.item}>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>
                                Pago: (-) ${total}
                            </td>
                        </tr>
                        <tr className={styles.total}>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>
                                Saldo adeudado: ${0}
                            </td>
                        </tr>
                    </>)
                }
            </table>
        </div>
    )
}